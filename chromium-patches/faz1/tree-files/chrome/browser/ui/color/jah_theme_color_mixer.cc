// Copyright 2026 JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/color/jah_theme_color_mixer.h"

#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/color/color_id.h"
#include "ui/color/color_mixer.h"
#include "ui/color/color_provider.h"
#include "ui/color/color_recipe.h"

namespace {

// JahBrowser "Jah" design tokens (see jah-ui/tokens/jah-theme.css). Kept in one
// place so the C++ chrome palette stays in lock-step with the WebUI tokens.
// Zemin / surfaces:
constexpr SkColor kJahBg = SkColorSetRGB(0x0B, 0x0E, 0x0F);        // --jah-bg
constexpr SkColor kJahBgDeep = SkColorSetRGB(0x07, 0x09, 0x09);    // --jah-bg-deep
constexpr SkColor kJahSurface = SkColorSetRGB(0x19, 0x1B, 0x1F);   // --jah-surface
constexpr SkColor kJahSurface2 = SkColorSetRGB(0x24, 0x27, 0x2C);  // --jah-surface-2
constexpr SkColor kJahBorder = SkColorSetRGB(0x33, 0x38, 0x3F);    // --jah-border
// Metin:
constexpr SkColor kJahText = SkColorSetRGB(0xF2, 0xF2, 0xF0);      // --jah-text
constexpr SkColor kJahTextDim = SkColorSetRGB(0x9B, 0xA1, 0xA6);   // --jah-text-dim
// Aksan (yalnizca focus/indicator; ASLA zemin veya metin):
constexpr SkColor kJahAccent = SkColorSetRGB(0x53, 0xFC, 0x18);    // --jah-accent

}  // namespace

void AddJahThemeColorMixer(ui::ColorProvider* provider,
                           const ui::ColorProviderKey& key) {
  // Respect user/extension themes and installed web-app (PWA) window colors:
  // only paint the Jah default when nothing else is themed. This keeps the
  // "JahBrowser looks like Jah by default" promise while leaving the Chrome
  // theming machinery fully functional.
  if (key.custom_theme || key.app_controller) {
    return;
  }

  // Jah is the dark default. If the user explicitly opts into light mode we step
  // aside and let stock light chrome render, rather than producing a broken
  // half-dark surface set. The forced dark default (kBrowserColorScheme = kDark
  // in ThemeService::RegisterProfilePrefs) means everyone gets Jah dark out of
  // the box with no user action.
  if (key.color_mode != ui::ColorProviderKey::ColorMode::kDark) {
    return;
  }

  ui::ColorMixer& mixer = provider->AddMixer();

  // --- Window frame -------------------------------------------------------
  mixer[ui::kColorFrameActive] = {kJahBg};
  mixer[ui::kColorFrameInactive] = {kJahBgDeep};

  // --- Toolbar ------------------------------------------------------------
  // Frame and toolbar share the deep base so the top of the window reads as one
  // seamless dark bar; the omnibox pill (surface) rises out of it.
  mixer[kColorToolbar] = {kJahBg};
  mixer[kColorToolbarText] = {kJahText};
  mixer[kColorToolbarButtonIcon] = {kJahTextDim};
  mixer[kColorToolbarButtonIconHovered] = {kJahText};
  mixer[kColorToolbarButtonIconInactive] = {kJahTextDim};
  mixer[kColorToolbarSeparator] = {kJahBorder};

  // --- Omnibox / location bar --------------------------------------------
  mixer[kColorLocationBarBackground] = {kJahSurface};
  mixer[kColorLocationBarBackgroundHovered] = {kJahSurface2};

  // --- Tab strip ----------------------------------------------------------
  // Active tab = raised surface; inactive tabs recede into the frame.
  mixer[kColorTabBackgroundActiveFrameActive] = {kJahSurface};
  mixer[kColorTabBackgroundActiveFrameInactive] = {kJahSurface};
  mixer[kColorTabBackgroundInactiveFrameActive] = {kJahBg};
  mixer[kColorTabBackgroundInactiveFrameInactive] = {kJahBgDeep};
  mixer[kColorTabForegroundActiveFrameActive] = {kJahText};
  mixer[kColorTabForegroundActiveFrameInactive] = {kJahText};
  mixer[kColorTabForegroundInactiveFrameActive] = {kJahTextDim};
  mixer[kColorTabForegroundInactiveFrameInactive] = {kJahTextDim};
  mixer[kColorNewTabButtonBackgroundFrameActive] = {kJahBg};
  mixer[kColorNewTabButtonBackgroundFrameInactive] = {kJahBgDeep};

  // --- Accent: focus ring / indicators only (never a surface or text) -----
  mixer[ui::kColorFocusableBorderFocused] = {kJahAccent};
}
