// Copyright 2026 The JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_VIEWS_TOOLBAR_JAH_ON_AIR_VIEW_H_
#define CHROME_BROWSER_UI_VIEWS_TOOLBAR_JAH_ON_AIR_VIEW_H_

#include "components/prefs/pref_member.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/controls/label.h"

class PrefService;

// JahBrowser: a persistent "ON AIR" (Yayın Modu) indicator pill shown in the
// browser toolbar while broadcast mode is active. Visibility is driven by the
// browser pref `prefs::kJahBroadcastMode` (default false). The pill uses the
// JahBrowser design token colors --jah-onair (#EB0400) background with white
// (--jah-text-on-danger) text; see jah-ui/tokens/jah-theme.css.
class JahOnAirView : public views::Label {
  METADATA_HEADER(JahOnAirView, views::Label)

 public:
  explicit JahOnAirView(PrefService* prefs);
  JahOnAirView(const JahOnAirView&) = delete;
  JahOnAirView& operator=(const JahOnAirView&) = delete;
  ~JahOnAirView() override;

 private:
  // Syncs this view's visibility with the current pref value.
  void UpdateVisibilityFromPref();

  BooleanPrefMember broadcast_mode_pref_;
};

#endif  // CHROME_BROWSER_UI_VIEWS_TOOLBAR_JAH_ON_AIR_VIEW_H_
