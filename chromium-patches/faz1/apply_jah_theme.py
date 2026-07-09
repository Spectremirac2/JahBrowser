#!/usr/bin/env python3
"""JahBrowser Faz 1 — Jah default theme patch applier.

Applies the dark "Jah" browser-chrome theme to a Chromium checkout:
  - copies jah_theme_color_mixer.{cc,h} into chrome/browser/ui/color/
  - wires the mixer into the color pipeline (BUILD.gn + chrome_color_mixers.cc)
  - defaults kBrowserColorScheme to kDark so the palette renders out of the box

Idempotent, backed up (.jah.bak), reversible. Run --check before --apply.
Rebase flow: --revert (or git checkout) -> gclient sync -> --check -> --apply.
Do NOT run --apply while a ninja build is in progress.

Usage:
  python apply_jah_theme.py --check   [<chromium_src>]
  python apply_jah_theme.py --apply   [<chromium_src>]
  python apply_jah_theme.py --revert  [<chromium_src>]
"""
import os
import shutil
import sys

DEFAULT_SRC = r"E:/src/chromium/src"
HERE = os.path.dirname(os.path.abspath(__file__))
TREE_FILES = os.path.join(HERE, "tree-files")

# New files copied verbatim into the tree (src-relative dest).
COPY_FILES = [
    "chrome/browser/ui/color/jah_theme_color_mixer.cc",
    "chrome/browser/ui/color/jah_theme_color_mixer.h",
]

# Edits to existing files: (path, anchor, new_text, sentinel)
#   anchor   -> exact upstream text to replace (verified via Read)
#   new_text -> replacement (must match the applied tree exactly)
#   sentinel -> short string present ONLY after this edit (idempotency check)
EDITS = [
    (
        "chrome/browser/ui/color/BUILD.gn",
        '    "chrome_color_mixers.cc",\n    "chrome_color_mixers.h",\n'
        '    "chrome_color_provider_utils.cc",',
        '    "chrome_color_mixers.cc",\n    "chrome_color_mixers.h",\n'
        '    "jah_theme_color_mixer.cc",\n    "jah_theme_color_mixer.h",\n'
        '    "chrome_color_provider_utils.cc",',
        '"jah_theme_color_mixer.cc",',
    ),
    (
        "chrome/browser/ui/color/chrome_color_mixers.cc",
        '#include "chrome/browser/ui/color/native_chrome_color_mixer.h"\n'
        '#include "chrome/browser/ui/color/new_tab_page_color_mixer.h"',
        '#include "chrome/browser/ui/color/jah_theme_color_mixer.h"\n'
        '#include "chrome/browser/ui/color/native_chrome_color_mixer.h"\n'
        '#include "chrome/browser/ui/color/new_tab_page_color_mixer.h"',
        '#include "chrome/browser/ui/color/jah_theme_color_mixer.h"',
    ),
    (
        "chrome/browser/ui/color/chrome_color_mixers.cc",
        "  // Must be the last one in order to override other mixer colors.\n"
        "  AddNativeChromeColorMixer(provider, key);\n\n"
        "  if (key.custom_theme) {",
        "  // Must be the last one in order to override other mixer colors.\n"
        "  AddNativeChromeColorMixer(provider, key);\n\n"
        "  // JahBrowser default-brand recolor. Runs after the native mixer so it\n"
        "  // wins; internally no-ops for custom/extension themes, PWA app windows,\n"
        "  // and light mode so it only paints the dark Jah default.\n"
        "  AddJahThemeColorMixer(provider, key);\n\n"
        "  if (key.custom_theme) {",
        "AddJahThemeColorMixer(provider, key);",
    ),
    (
        "chrome/browser/themes/theme_service.cc",
        "  registry->RegisterIntegerPref(\n"
        "      prefs::kBrowserColorScheme,\n"
        "      std::to_underlying(ThemeService::BrowserColorScheme::kSystem));",
        "  // JahBrowser: default to a dark browser color scheme so the Jah\n"
        "  // palette renders out of the box with no user action.\n"
        "  registry->RegisterIntegerPref(\n"
        "      prefs::kBrowserColorScheme,\n"
        "      std::to_underlying(ThemeService::BrowserColorScheme::kDark));",
        "BrowserColorScheme::kDark));",
    ),
]


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def check(src):
    ok = True
    for rel in COPY_FILES:
        if not os.path.exists(os.path.join(TREE_FILES, rel)):
            print(f"  [EKSIK] kaynak dosya yok: tree-files/{rel}")
            ok = False
    for rel, anchor, _new_text, sentinel in EDITS:
        path = os.path.join(src, rel)
        if not os.path.exists(path):
            print(f"  [EKSIK] {rel} bulunamadi")
            ok = False
            continue
        content = read(path)
        if sentinel in content:
            print(f"  [UYGULANMIS] {rel} ({sentinel})")
        elif anchor in content:
            print(f"  [UYGULANACAK] {rel}")
        else:
            print(f"  [ANCHOR YOK] {rel} -- upstream degismis olabilir")
            ok = False
    return ok


def apply(src):
    if not check(src):
        print("\nSONUC: Anchor dogrulamasi basarisiz -- HICBIR sey yazilmadi.")
        return 1
    for rel in COPY_FILES:
        dst = os.path.join(src, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(TREE_FILES, rel), dst)
        print(f"  [kopya] {rel}")
    changed = 0
    for rel, anchor, new_text, sentinel in EDITS:
        path = os.path.join(src, rel)
        content = read(path)
        if sentinel in content:
            continue
        bak = path + ".jah.bak"
        if not os.path.exists(bak):
            shutil.copyfile(path, bak)
        write(path, content.replace(anchor, new_text, 1))
        print(f"  [yazdi] {rel}")
        changed += 1
    print(f"\nSONUC: {changed} dosya duzenlendi, {len(COPY_FILES)} dosya kopyalandi.")
    print("Simdi: autoninja -C out/Default chrome")
    return 0


def revert(src):
    n = 0
    for rel, _a, _n, _m in EDITS:
        bak = os.path.join(src, rel) + ".jah.bak"
        if os.path.exists(bak):
            shutil.copyfile(bak, os.path.join(src, rel))
            os.remove(bak)
            print(f"  [geri] {rel}")
            n += 1
    print(f"\nSONUC: {n} dosya geri alindi. (kopyalanan yeni dosyalar silinmedi)")
    return 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = args[0] if args else DEFAULT_SRC
    mode = next((a for a in sys.argv[1:] if a.startswith("--")), "--check")
    print(f"JahBrowser Jah teması — {mode} — hedef: {src}\n")
    if mode == "--check":
        return 0 if check(src) else 1
    if mode == "--apply":
        return apply(src)
    if mode == "--revert":
        return revert(src)
    print("Bilinmeyen mod. --check | --apply | --revert")
    return 2


if __name__ == "__main__":
    sys.exit(main())
