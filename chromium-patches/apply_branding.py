#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_branding.py — JahBrowser NAME-ONLY rebrand patch araci (v1).

Chromium kaynak agacina "Chromium" -> "JahBrowser" isim rebrand'ini uygular.
Kapsam (branding-patch-plani.md, Adim 1/2/3/5 — SADECE ISIM, ikon YOK):

  1. chrome/app/theme/chromium/BRANDING
       PRODUCT_FULLNAME/SHORTNAME, COMPANY_*, PRODUCT_INSTALLER_* -> JahBrowser
       (Task Manager ProductName, exe Ozellikler > Ayrintilar, VERSIONINFO)
  2. chrome/app/chromium_strings.grd
       IDS_PRODUCT_NAME, IDS_SHORT_PRODUCT_NAME, IDS_BROWSER_WINDOW_TITLE_FORMAT
       dahil dosya genelinde \\bChromium\\b -> JahBrowser
       (ChromiumOS / ChromiumUpdater bilesik kelimeleri DOKUNULMAZ)
  3. chrome/app/resources/chromium_strings_tr.xtb
       Turkce ceviriler; ek olarak unlu uyumu duzeltmeli ek esleme
       (Chromium'u -> JahBrowser'i vb.)
  4. chrome/install_static/chromium_install_modes.h
       kProductPathName / base_app_name / base_app_id -> JahBrowser
       (user-data dizini %LOCALAPPDATA%\\JahBrowser\\User Data + AppUserModelID)

Modlar:
  --check   Kuru calisma: tum anchor'lari dogrula, planlanan degisiklikleri
            listele. Anchor eksikse cikis kodu 1.
  --apply   Uygula: her dosya icin .jah.bak yedegi olustur (varsa dokunma),
            degisiklikleri yaz. Idempotent — ikinci calistirma zararsiz.
  --revert  .jah.bak yedeklerinden geri yukle.

Kullanim:
  python apply_branding.py [AGAC_YOLU] --check
  python apply_branding.py [AGAC_YOLU] --apply
  python apply_branding.py [AGAC_YOLU] --revert
  AGAC_YOLU verilmezse E:/src/chromium/src kullanilir.
"""

import argparse
import os
import re
import shutil
import sys

DEFAULT_TREE = "E:/src/chromium/src"
NEW_NAME = "JahBrowser"
BAK_SUFFIX = ".jah.bak"

# \bChromium\b : "ChromiumOS", "ChromiumUpdater" gibi bilesikleri ESLEMEZ,
# "Chromium'u" / "Chromium's" gibi apostroflu formlarin govdesini ESLER.
WORD_RE = re.compile(r"\bChromium\b")

# ---------------------------------------------------------------------------
# 1) BRANDING (key=value)
# ---------------------------------------------------------------------------

BRANDING_KEYS = {
    "COMPANY_FULLNAME": "JahBrowser Authors",
    "COMPANY_SHORTNAME": "JahBrowser",
    "PRODUCT_FULLNAME": "JahBrowser",
    "PRODUCT_SHORTNAME": "JahBrowser",
    "PRODUCT_INSTALLER_FULLNAME": "JahBrowser Installer",
    "PRODUCT_INSTALLER_SHORTNAME": "JahBrowser Installer",
}
# COPYRIGHT ve MAC_* satirlari bilerek dokunulmadan birakilir (plan geregi).

# ---------------------------------------------------------------------------
# 3) TR .xtb — unlu uyumu duzeltmeli ekler (uzun form once!)
#    Genel \bChromium\b esleme "Chromium'da" -> "JahBrowser'da" gibi ayni ek
#    korunan formlari zaten dogru cevirir; asagidakiler ek DEGISTIRILMESI
#    gereken formlar ("brau-zir" son hecesi kalin unlu -> i/a uyumu).
# ---------------------------------------------------------------------------

TR_SUFFIX_MAP = [
    ("Chromium'unuzu", "JahBrowser'ınızı"),
    ("Chromium'unuz", "JahBrowser'ınız"),
    ("Chromium'un", "JahBrowser'ın"),
    ("Chromium'u", "JahBrowser'ı"),
]

# ---------------------------------------------------------------------------
# 4) install_modes header — birebir anchor ciftleri (eski, yeni)
# ---------------------------------------------------------------------------

INSTALL_MODES_PAIRS = [
    ('inline constexpr wchar_t kProductPathName[] = L"Chromium";',
     'inline constexpr wchar_t kProductPathName[] = L"JahBrowser";'),
    ('.base_app_name = L"Chromium",',
     '.base_app_name = L"JahBrowser",'),
    ('.base_app_id = L"Chromium",',
     '.base_app_id = L"JahBrowser",'),
]

# GRD icinde mutlaka bulunmasi gereken mesaj anchor'lari
GRD_ANCHORS = [
    'name="IDS_PRODUCT_NAME"',
    'name="IDS_SHORT_PRODUCT_NAME"',
    'name="IDS_BROWSER_WINDOW_TITLE_FORMAT"',
]

XTB_ANCHOR = '<translationbundle lang="tr">'


# ---------------------------------------------------------------------------
# Dosya gorevleri
# ---------------------------------------------------------------------------

class FileTask:
    """Tek dosyanin kontrol/uygulama mantigi."""

    def __init__(self, rel_path):
        self.rel_path = rel_path

    # (status, mesaj_listesi) dondurur. status: "pending"|"applied"|"error"
    def check(self, text):
        raise NotImplementedError

    def transform(self, text):
        raise NotImplementedError


class BrandingTask(FileTask):
    def check(self, text):
        msgs, missing, pending = [], [], 0
        for key, target in BRANDING_KEYS.items():
            m = re.search(r"^%s=(.*)$" % re.escape(key), text, re.MULTILINE)
            if not m:
                missing.append(key)
                continue
            cur = m.group(1).strip()
            if cur == target:
                msgs.append("    [ok]    %s=%s (zaten hedef deger)" % (key, cur))
            else:
                pending += 1
                msgs.append("    [degis] %s: '%s' -> '%s'" % (key, cur, target))
        if missing:
            return "error", msgs + [
                "    [HATA]  eksik anahtar(lar): %s" % ", ".join(missing)]
        return ("pending" if pending else "applied"), msgs

    def transform(self, text):
        for key, target in BRANDING_KEYS.items():
            text = re.sub(r"^%s=.*$" % re.escape(key),
                          "%s=%s" % (key, target), text, flags=re.MULTILINE)
        return text


class GrdTask(FileTask):
    def check(self, text):
        msgs, missing = [], []
        for anchor in GRD_ANCHORS:
            if anchor in text:
                msgs.append("    [ok]    anchor bulundu: %s" % anchor)
            else:
                missing.append(anchor)
        n_old = len(WORD_RE.findall(text))
        n_new = text.count(NEW_NAME)
        msgs.append("    [bilgi] bagimsiz 'Chromium' token: %d, '%s': %d"
                    % (n_old, NEW_NAME, n_new))
        n_compound = len(re.findall(r"Chromium[A-Za-z]", text))
        msgs.append("    [bilgi] dokunulmayacak bilesik (ChromiumOS/Updater vb.): %d"
                    % n_compound)
        if missing:
            return "error", msgs + [
                "    [HATA]  eksik anchor(lar): %s" % ", ".join(missing)]
        if n_old > 0:
            msgs.append("    [degis] %d adet 'Chromium' -> '%s' degistirilecek"
                        % (n_old, NEW_NAME))
            return "pending", msgs
        if n_new > 0:
            return "applied", msgs
        return "error", msgs + [
            "    [HATA]  ne 'Chromium' ne '%s' bulundu — beklenmedik icerik" % NEW_NAME]

    def transform(self, text):
        return WORD_RE.sub(NEW_NAME, text)


class XtbTask(FileTask):
    def check(self, text):
        msgs = []
        if XTB_ANCHOR not in text:
            return "error", ["    [HATA]  anchor yok: %s" % XTB_ANCHOR]
        msgs.append("    [ok]    anchor bulundu: %s" % XTB_ANCHOR)
        n_old = len(WORD_RE.findall(text))
        # Kesin sayim icin donusumu simule et (uzun form once, cakisma yok)
        n_suffix, tmp = 0, text
        for old, new in TR_SUFFIX_MAP:
            c = tmp.count(old)
            if c:
                msgs.append("    [degis] %d adet '%s' -> '%s'" % (c, old, new))
                n_suffix += c
                tmp = tmp.replace(old, new)
        n_generic = n_old - n_suffix
        n_new = text.count(NEW_NAME)
        msgs.append("    [bilgi] bagimsiz 'Chromium' token: %d "
                    "(unlu-uyumu ozel ek: %d, genel: %d); '%s': %d"
                    % (n_old, n_suffix, n_generic, NEW_NAME, n_new))
        n_compound = len(re.findall(r"Chromium[A-Za-z]", text))
        msgs.append("    [bilgi] dokunulmayacak bilesik (ChromiumOS vb.): %d"
                    % n_compound)
        if n_old > 0:
            msgs.append("    [degis] toplam %d adet 'Chromium' -> '%s'"
                        % (n_old, NEW_NAME))
            return "pending", msgs
        if n_new > 0:
            return "applied", msgs
        return "error", msgs + [
            "    [HATA]  ne 'Chromium' ne '%s' bulundu — beklenmedik icerik" % NEW_NAME]

    def transform(self, text):
        for old, new in TR_SUFFIX_MAP:  # uzun form once — sira onemli
            text = text.replace(old, new)
        return WORD_RE.sub(NEW_NAME, text)


class InstallModesTask(FileTask):
    def check(self, text):
        msgs, missing, pending = [], [], 0
        for old, new in INSTALL_MODES_PAIRS:
            if old in text:
                pending += 1
                msgs.append("    [degis] %s" % old.strip())
            elif new in text:
                msgs.append("    [ok]    zaten uygulanmis: %s" % new.strip())
            else:
                missing.append(old.strip())
        if missing:
            return "error", msgs + [
                "    [HATA]  anchor bulunamadi (upstream degismis olabilir):"
            ] + ["            %s" % a for a in missing]
        return ("pending" if pending else "applied"), msgs

    def transform(self, text):
        for old, new in INSTALL_MODES_PAIRS:
            text = text.replace(old, new)
        return text


TASKS = [
    BrandingTask("chrome/app/theme/chromium/BRANDING"),
    GrdTask("chrome/app/chromium_strings.grd"),
    XtbTask("chrome/app/resources/chromium_strings_tr.xtb"),
    InstallModesTask("chrome/install_static/chromium_install_modes.h"),
]


# ---------------------------------------------------------------------------
# Yardimcilar
# ---------------------------------------------------------------------------

def read_text(path):
    # newline='' : LF/CRLF ne ise aynen korunur
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def do_check(tree):
    print("=== JahBrowser branding KONTROL (kuru calisma) ===")
    print("Agac: %s" % tree)
    print()
    ok = True
    summary = []
    for task in TASKS:
        path = os.path.join(tree, task.rel_path)
        print("[%s]" % task.rel_path)
        if not os.path.isfile(path):
            print("    [HATA]  dosya bulunamadi: %s" % path)
            summary.append((task.rel_path, "DOSYA-YOK"))
            ok = False
            print()
            continue
        try:
            text = read_text(path)
        except UnicodeDecodeError as e:
            print("    [HATA]  UTF-8 okunamadi: %s" % e)
            summary.append((task.rel_path, "OKUNAMADI"))
            ok = False
            print()
            continue
        status, msgs = task.check(text)
        for m in msgs:
            print(m)
        if status == "error":
            ok = False
        label = {"pending": "UYGULANACAK", "applied": "ZATEN-UYGULANMIS",
                 "error": "ANCHOR-HATASI"}[status]
        summary.append((task.rel_path, label))
        print("    Durum: %s" % label)
        print()
    print("=== Ozet ===")
    for rel, label in summary:
        print("  %-55s %s" % (rel, label))
    if ok:
        print("\nSONUC: Tum anchor'lar dogrulandi. --apply guvenle calistirilabilir.")
        return 0
    print("\nSONUC: ANCHOR HATASI var! Yukaridaki [HATA] satirlarini duzeltmeden "
          "--apply CALISTIRMAYIN.")
    return 1


def do_apply(tree):
    # Once tam kontrol — anchor hatasi varsa hicbir sey yazma.
    rc = do_check(tree)
    if rc != 0:
        print("\n--apply iptal edildi (kontrol basarisiz).")
        return 1
    print("\n=== UYGULAMA ===")
    changed, skipped = 0, 0
    for task in TASKS:
        path = os.path.join(tree, task.rel_path)
        text = read_text(path)
        new_text = task.transform(text)
        if new_text == text:
            print("[atla ] %s (degisiklik gerekmiyor — idempotent)" % task.rel_path)
            skipped += 1
            continue
        bak = path + BAK_SUFFIX
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
            print("[yedek] %s -> %s" % (task.rel_path, os.path.basename(bak)))
        else:
            print("[yedek] %s zaten var, korunuyor (orijinal icerik)" %
                  os.path.basename(bak))
        write_text(path, new_text)
        print("[yazdi] %s" % task.rel_path)
        changed += 1
    print("\nSONUC: %d dosya degistirildi, %d dosya zaten uygulanmisti." %
          (changed, skipped))
    print("Simdi: autoninja -C out/Default chrome  (BRANDING degisimini ninja "
          "otomatik yakalar, gn args degismez)")
    return 0


def do_revert(tree):
    print("=== GERI ALMA (.jah.bak) ===")
    restored, missing = 0, 0
    for task in TASKS:
        path = os.path.join(tree, task.rel_path)
        bak = path + BAK_SUFFIX
        if os.path.exists(bak):
            shutil.copy2(bak, path)
            os.remove(bak)
            print("[geri ] %s (yedekten yuklendi, yedek silindi)" % task.rel_path)
            restored += 1
        else:
            print("[yok  ] %s icin yedek bulunamadi, dokunulmadi" % task.rel_path)
            missing += 1
    print("\nSONUC: %d dosya geri alindi, %d dosyanin yedegi yoktu." %
          (restored, missing))
    return 0


def main(argv):
    # Windows konsolunda Turkce cikti icin
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(
        description="JahBrowser NAME-ONLY branding patch araci (ikon yok, v1).")
    parser.add_argument("tree", nargs="?", default=DEFAULT_TREE,
                        help="Chromium kaynak agaci (varsayilan: %s)" % DEFAULT_TREE)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true",
                       help="Kuru calisma: anchor dogrula, plan listele")
    group.add_argument("--apply", action="store_true",
                       help="Degisiklikleri uygula (.jah.bak yedekli, idempotent)")
    group.add_argument("--revert", action="store_true",
                       help=".jah.bak yedeklerinden geri al")
    args = parser.parse_args(argv)

    tree = os.path.abspath(args.tree)
    if not os.path.isdir(tree):
        print("HATA: agac dizini yok: %s" % tree)
        return 1
    probe = os.path.join(tree, "chrome", "app")
    if not os.path.isdir(probe):
        print("HATA: %s bir Chromium kaynak agacina benzemiyor "
              "(chrome/app bulunamadi)." % tree)
        return 1

    if args.check:
        return do_check(tree)
    if args.apply:
        return do_apply(tree)
    return do_revert(tree)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
