#!/usr/bin/env python3
"""
Murtal Smart Quran - Real Android APK Package Builder
Compiles AndroidManifest.xml (binary AXML), resources.arsc, MainActivity.java -> classes.dex,
bundles the compiled Vite web application + offline Quran database, aligns with zipalign,
and signs with apksigner (v1 + v2/v3 APK Signature Scheme).
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST_DIR = os.path.join(BASE_DIR, 'dist')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
OUTPUT_DIR = os.path.join(PUBLIC_DIR, 'downloads')
DATA_DIR = os.path.join(BASE_DIR, 'src', 'data')
SERVER_DATA_DIR = os.path.join(BASE_DIR, 'data')
ANDROID_SRC_DIR = os.path.join(BASE_DIR, 'android', 'app', 'src', 'main')

APK_FILENAME = 'murtal-quran.apk'
APP_VERSION_NAME = '1.1.0'
APP_VERSION_CODE = 110
APK_PATH = os.path.join(OUTPUT_DIR, APK_FILENAME)
DIST_APK_PATH = os.path.join(DIST_DIR, 'downloads', APK_FILENAME)


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(DIST_DIR, 'downloads'), exist_ok=True)
    os.makedirs(SERVER_DATA_DIR, exist_ok=True)


def parse_version_tuple(name: str):
    nums = [int(x) for x in re.findall(r'\d+', name)]
    return tuple(nums) if nums else (0,)


def find_java_tool(name: str):
    java_home = os.environ.get('JAVA_HOME')
    if java_home:
        candidate = os.path.join(java_home, 'bin', name)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return shutil.which(name)


def find_android_sdk():
    candidates = [
        os.environ.get('ANDROID_HOME'),
        os.environ.get('ANDROID_SDK_ROOT'),
        '/usr/local/lib/android/sdk',
        '/opt/android-sdk',
        os.path.expanduser('~/Android/Sdk'),
    ]
    sdk_root = None
    for c in candidates:
        if c and os.path.isdir(c):
            sdk_root = c
            break

    if not sdk_root:
        return None

    build_tools_root = os.path.join(sdk_root, 'build-tools')
    platforms_root = os.path.join(sdk_root, 'platforms')
    if not os.path.isdir(build_tools_root) or not os.path.isdir(platforms_root):
        return None

    required_bt = ['aapt2', 'd8', 'zipalign', 'apksigner']
    selected_bt_dir = None
    for entry in sorted(os.listdir(build_tools_root), key=parse_version_tuple, reverse=True):
        bt_path = os.path.join(build_tools_root, entry)
        if all(os.path.isfile(os.path.join(bt_path, tool)) for tool in required_bt):
            selected_bt_dir = bt_path
            break

    if not selected_bt_dir:
        return None

    selected_android_jar = None
    preferred_apis = ['android-34', 'android-35', 'android-33']
    platform_entries = sorted(os.listdir(platforms_root), key=parse_version_tuple, reverse=True)
    ordered_platforms = preferred_apis + [p for p in platform_entries if p not in preferred_apis]

    for p in ordered_platforms:
        jar_path = os.path.join(platforms_root, p, 'android.jar')
        if os.path.isfile(jar_path):
            api_ver = parse_version_tuple(p)[0]
            if api_ver >= 24:
                selected_android_jar = jar_path
                break

    if not selected_android_jar:
        return None

    javac = find_java_tool('javac')
    jar = find_java_tool('jar')
    keytool = find_java_tool('keytool')
    if not javac or not jar or not keytool:
        return None

    return {
        'sdk_root': sdk_root,
        'aapt2': os.path.join(selected_bt_dir, 'aapt2'),
        'd8': os.path.join(selected_bt_dir, 'd8'),
        'zipalign': os.path.join(selected_bt_dir, 'zipalign'),
        'apksigner': os.path.join(selected_bt_dir, 'apksigner'),
        'android_jar': selected_android_jar,
        'javac': javac,
        'jar': jar,
        'keytool': keytool,
    }


def run_cmd(cmd, label: str):
    print(f"[APK Build] {label}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        raise RuntimeError(f"{label} failed with exit code {result.returncode}")
    return result


def build_apk_info_dict(apk_size: int, apk_sha256: str):
    size_mb = f"{apk_size / (1024 * 1024):.1f} ميجابايت"
    return {
        "appId": "com.murtal.smartquran",
        "appName": "مرتل القرآن الذكي - نظام التجويد والحفظ",
        "version": APP_VERSION_NAME,
        "versionCode": APP_VERSION_CODE,
        "filename": APK_FILENAME,
        "downloadUrl": "/downloads/murtal-quran.apk",
        "apiUrl": "/api/apk/download",
        "fileSizeBytes": apk_size,
        "fileSizeFormatted": size_mb,
        "sha256": apk_sha256,
        "releaseDate": time.strftime("%Y-%m-%d"),
        "minAndroid": "Android 7.0 (Nougat) أو أحدث",
        "targetAndroid": "Android 14 / 15 (API 34+)",
        "downloadCount": 184,
        "bundledDatabaseStats": {
            "surahsCount": 114,
            "ayahsCount": 6236,
            "juzCount": 30,
            "recitersCount": 14,
            "adhkarCount": 12,
            "shatibiyyahChaptersCount": 6,
            "shatibiyyahAbyatCount": 25,
            "jazariyyahChaptersCount": 4,
            "jazariyyahAbyatCount": 21,
            "hisnCategoriesCount": 6,
            "hisnItemsCount": 28,
            "offlineCapability": "تشغيل أوفلاين كامل بدون إنترنت (المصحف والأذكار وحصن المسلم والشاطبية والجزرية)",
        },
    }


def build_real_apk(tools):
    ensure_dirs()
    if not os.path.isfile(os.path.join(DIST_DIR, 'index.html')):
        raise RuntimeError("dist/index.html not found. Run 'npm run build' before building the APK.")

    manifest_src = os.path.join(ANDROID_SRC_DIR, 'AndroidManifest.xml')
    java_src = os.path.join(ANDROID_SRC_DIR, 'java', 'com', 'murtal', 'smartquran', 'MainActivity.java')
    strings_src = os.path.join(ANDROID_SRC_DIR, 'res', 'values', 'strings.xml')

    for req in [manifest_src, java_src, strings_src]:
        if not os.path.isfile(req):
            raise RuntimeError(f"Missing required Android source file: {req}")

    with tempfile.TemporaryDirectory(prefix='murtal_apk_') as work_dir:
        res_dir = os.path.join(work_dir, 'res')
        assets_dir = os.path.join(work_dir, 'assets')
        gen_java_dir = os.path.join(work_dir, 'gen')
        classes_dir = os.path.join(work_dir, 'classes')
        dex_dir = os.path.join(work_dir, 'dex')

        os.makedirs(os.path.join(res_dir, 'values'), exist_ok=True)
        os.makedirs(os.path.join(assets_dir, 'www'), exist_ok=True)
        os.makedirs(os.path.join(assets_dir, 'database'), exist_ok=True)
        os.makedirs(gen_java_dir, exist_ok=True)
        os.makedirs(classes_dir, exist_ok=True)
        os.makedirs(dex_dir, exist_ok=True)

        # 1. Prepare Android resources (strings.xml + launcher icons)
        shutil.copy2(strings_src, os.path.join(res_dir, 'values', 'strings.xml'))

        icon_192 = os.path.join(PUBLIC_DIR, 'pwa-192x192.png')
        icon_512 = os.path.join(PUBLIC_DIR, 'pwa-512x512.png')
        density_map = {
            'mipmap-mdpi': icon_192,
            'mipmap-hdpi': icon_192,
            'mipmap-xhdpi': icon_192,
            'mipmap-xxhdpi': icon_512 if os.path.isfile(icon_512) else icon_192,
            'mipmap-xxxhdpi': icon_512 if os.path.isfile(icon_512) else icon_192,
        }
        for folder, src_icon in density_map.items():
            if os.path.isfile(src_icon):
                dst_folder = os.path.join(res_dir, folder)
                os.makedirs(dst_folder, exist_ok=True)
                shutil.copy2(src_icon, os.path.join(dst_folder, 'ic_launcher.png'))

        # 2. Prepare bundled web assets (dist/) & database assets
        for root, _dirs, files in os.walk(DIST_DIR):
            for fname in files:
                full_path = os.path.join(root, fname)
                rel_path = os.path.relpath(full_path, DIST_DIR)
                if rel_path == 'downloads' or rel_path.startswith('downloads' + os.sep):
                    continue
                dest_path = os.path.join(assets_dir, 'www', rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                shutil.copy2(full_path, dest_path)

        quran_json_path = os.path.join(DATA_DIR, 'quran_full.json')
        if os.path.isfile(quran_json_path):
            shutil.copy2(quran_json_path, os.path.join(assets_dir, 'database', 'quran_database.json'))

        db_meta = build_apk_info_dict(0, '')
        with open(os.path.join(assets_dir, 'database', 'apk_info.json'), 'w', encoding='utf-8') as f:
            json.dump(db_meta, f, ensure_ascii=False, indent=2)

        # 3. Compile resources with aapt2
        compiled_res_zip = os.path.join(work_dir, 'compiled_res.zip')
        run_cmd(
            [tools['aapt2'], 'compile', '--dir', res_dir, '-o', compiled_res_zip],
            'Compiling Android resources (aapt2 compile)',
        )

        # 4. Link resources, binary AndroidManifest.xml, and assets into base.apk
        base_apk = os.path.join(work_dir, 'base.apk')
        run_cmd(
            [
                tools['aapt2'],
                'link',
                '-o', base_apk,
                '-I', tools['android_jar'],
                '--manifest', manifest_src,
                '--java', gen_java_dir,
                '--min-sdk-version', '24',
                '--target-sdk-version', '34',
                '--version-code', str(APP_VERSION_CODE),
                '--version-name', APP_VERSION_NAME,
                '-A', assets_dir,
                compiled_res_zip,
            ],
            'Linking binary manifest & resources (aapt2 link)',
        )

        # 5. Compile Java sources (R.java + MainActivity.java)
        java_files = [java_src]
        for root, _dirs, files in os.walk(gen_java_dir):
            for fname in files:
                if fname.endswith('.java'):
                    java_files.append(os.path.join(root, fname))

        run_cmd(
            [tools['javac'], '--release', '8', '-cp', tools['android_jar'], '-d', classes_dir] + java_files,
            'Compiling MainActivity Java bytecode (javac)',
        )

        classes_jar = os.path.join(work_dir, 'classes.jar')
        run_cmd(
            [tools['jar'], 'cf', classes_jar, '-C', classes_dir, '.'],
            'Archiving compiled classes (jar)',
        )

        # 6. Convert Java bytecode to Dalvik Executable (classes.dex) via d8
        run_cmd(
            [tools['d8'], '--release', '--min-api', '24', '--lib', tools['android_jar'], '--output', dex_dir, classes_jar],
            'Compiling Dalvik bytecode (d8)',
        )

        # 7. Inject classes.dex into unaligned APK
        unaligned_apk = os.path.join(work_dir, 'unaligned.apk')
        shutil.copy2(base_apk, unaligned_apk)
        with zipfile.ZipFile(unaligned_apk, 'a', compression=zipfile.ZIP_DEFLATED) as zf:
            for fname in sorted(os.listdir(dex_dir)):
                if fname.endswith('.dex'):
                    zf.write(os.path.join(dex_dir, fname), fname)

        # 8. Align APK on 4-byte boundaries (required for Android 11+)
        aligned_apk = os.path.join(work_dir, 'aligned.apk')
        run_cmd(
            [tools['zipalign'], '-f', '-p', '4', unaligned_apk, aligned_apk],
            'Aligning APK archive (zipalign)',
        )

        # 9. Generate signing keystore if not supplied via environment
        ks_path = os.environ.get('ANDROID_KEYSTORE_PATH')
        ks_pass = os.environ.get('ANDROID_KEYSTORE_PASSWORD', 'murtal123')
        ks_alias = os.environ.get('ANDROID_KEY_ALIAS', 'murtal')
        key_pass = os.environ.get('ANDROID_KEY_PASSWORD', ks_pass)

        if not ks_path or not os.path.isfile(ks_path):
            ks_path = os.path.join(work_dir, 'release.keystore')
            run_cmd(
                [
                    tools['keytool'],
                    '-genkeypair',
                    '-noprompt',
                    '-keystore', ks_path,
                    '-storetype', 'PKCS12',
                    '-alias', ks_alias,
                    '-keyalg', 'RSA',
                    '-keysize', '2048',
                    '-validity', '10000',
                    '-storepass', ks_pass,
                    '-keypass', key_pass,
                    '-dname', 'CN=Murtal Smart Quran, OU=Mobile, O=Murtal, L=Makkah, S=Makkah, C=SA',
                ],
                'Generating APK signing key (keytool)',
            )

        # 10. Sign APK with v1 + v2/v3 APK Signature Scheme via apksigner
        run_cmd(
            [
                tools['apksigner'],
                'sign',
                '--ks', ks_path,
                '--ks-key-alias', ks_alias,
                '--ks-pass', f'pass:{ks_pass}',
                '--key-pass', f'pass:{key_pass}',
                '--v1-signing-enabled', 'true',
                '--v2-signing-enabled', 'true',
                '--out', APK_PATH,
                aligned_apk,
            ],
            'Signing Android APK (apksigner)',
        )

        # 11. Verify final signed APK
        run_cmd(
            [tools['apksigner'], 'verify', '--verbose', APK_PATH],
            'Verifying APK signature (apksigner verify)',
        )

    shutil.copy2(APK_PATH, DIST_APK_PATH)

    apk_size = os.path.getsize(APK_PATH)
    with open(APK_PATH, 'rb') as f:
        apk_sha256 = hashlib.sha256(f.read()).hexdigest()

    apk_info = build_apk_info_dict(apk_size, apk_sha256)
    info_path = os.path.join(SERVER_DATA_DIR, 'apk_database.json')
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(apk_info, f, ensure_ascii=False, indent=2)

    print(f"APK successfully built and verified: {APK_PATH}")
    print(f"Size: {apk_info['fileSizeFormatted']} ({apk_size} bytes)")
    print(f"SHA-256: {apk_sha256}")
    print(f"Metadata saved to: {info_path}")


def main():
    parser = argparse.ArgumentParser(description='Build signed Android APK for Murtal Smart Quran')
    parser.add_argument(
        '--require-sdk',
        action='store_true',
        help='Fail if Android SDK / JDK tools are unavailable',
    )
    args = parser.parse_args()

    is_ci = os.environ.get('CI') == 'true' or os.environ.get('GITHUB_ACTIONS') == 'true'
    tools = find_android_sdk()

    if not tools:
        msg = (
            "Android SDK build-tools (aapt2, d8, zipalign, apksigner), android.jar (API 24+), "
            "or JDK tools (javac, jar, keytool) were not found in this environment."
        )
        if is_ci or args.require_sdk:
            print(f"ERROR: {msg}", file=sys.stderr)
            sys.exit(1)
        print(f"NOTICE: {msg}")
        print("Skipping local APK binary packaging so an invalid/unsigned APK is not produced.")
        print("Run this workflow in GitHub Actions (ubuntu-latest) or with Android SDK installed to build the signed APK.")
        return

    build_real_apk(tools)


if __name__ == '__main__':
    main()
