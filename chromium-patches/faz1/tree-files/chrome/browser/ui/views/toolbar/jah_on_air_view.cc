// Copyright 2026 The JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/toolbar/jah_on_air_view.h"

#include "base/functional/bind.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/accessibility/ax_enums.mojom.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/font.h"
#include "ui/gfx/geometry/insets.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/background.h"
#include "ui/views/border.h"
#include "ui/views/layout/layout_types.h"
#include "ui/views/view_class_properties.h"

namespace {

// JahBrowser design tokens (jah-ui/tokens/jah-theme.css):
//   --jah-onair:          #EB0400  (ON AIR red, "you are broadcasting")
//   --jah-text-on-danger: #FFFFFF
constexpr SkColor kJahOnAirBackgroundColor = SkColorSetRGB(0xEB, 0x04, 0x00);
constexpr SkColor kJahOnAirTextColor = SK_ColorWHITE;

// --jah-radius-full pill.
constexpr float kJahOnAirCornerRadius = 999.0f;

// Padding inside the pill (approximates --jah-space-2 horizontal).
constexpr int kJahOnAirVerticalPadding = 2;
constexpr int kJahOnAirHorizontalPadding = 8;

// Spacing between the pill and neighboring toolbar controls.
constexpr int kJahOnAirOuterMargin = 4;

}  // namespace

JahOnAirView::JahOnAirView(PrefService* prefs) {
  // TODO(jah): Localize (Türkçe-first UI). "ON AIR" is an established broadcast
  // term; keep the badge glyph short and uppercase per the design tokens.
  SetText(u"ON AIR");
  SetAutoColorReadabilityEnabled(false);
  SetEnabledColor(kJahOnAirTextColor);
  SetFontList(font_list().Derive(0, gfx::Font::NORMAL, gfx::Font::Weight::BOLD));
  SetBackground(views::CreateRoundedRectBackground(kJahOnAirBackgroundColor,
                                                   kJahOnAirCornerRadius));
  SetBorder(views::CreateEmptyBorder(gfx::Insets::VH(
      kJahOnAirVerticalPadding, kJahOnAirHorizontalPadding)));

  SetProperty(views::kCrossAxisAlignmentKey, views::LayoutAlignment::kCenter);
  SetProperty(views::kMarginsKey,
              gfx::Insets::VH(0, kJahOnAirOuterMargin));

  GetViewAccessibility().SetRole(ax::mojom::Role::kStatus);

  broadcast_mode_pref_.Init(
      prefs::kJahBroadcastMode, prefs,
      base::BindRepeating(&JahOnAirView::UpdateVisibilityFromPref,
                          base::Unretained(this)));
  UpdateVisibilityFromPref();
}

JahOnAirView::~JahOnAirView() = default;

void JahOnAirView::UpdateVisibilityFromPref() {
  SetVisible(broadcast_mode_pref_.GetValue());
}

BEGIN_METADATA(JahOnAirView)
END_METADATA
