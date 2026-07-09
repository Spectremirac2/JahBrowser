// Copyright 2026 JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_COLOR_JAH_THEME_COLOR_MIXER_H_
#define CHROME_BROWSER_UI_COLOR_JAH_THEME_COLOR_MIXER_H_

#include "ui/color/color_provider_key.h"

namespace ui {
class ColorProvider;
}

// Adds the JahBrowser default-brand color mixer. This recolors the key browser
// chrome surfaces (frame, toolbar, tabstrip, omnibox) to the dark "Jah" palette
// so JahBrowser never renders like stock Chromium out of the box. It runs after
// all other Chrome mixers so it wins, but only when no custom/extension theme is
// installed, so user themes keep working. Neon green (--jah-accent) is used only
// for the focus ring / indicators, never as a surface or text color.
void AddJahThemeColorMixer(ui::ColorProvider* provider,
                           const ui::ColorProviderKey& key);

#endif  // CHROME_BROWSER_UI_COLOR_JAH_THEME_COLOR_MIXER_H_
