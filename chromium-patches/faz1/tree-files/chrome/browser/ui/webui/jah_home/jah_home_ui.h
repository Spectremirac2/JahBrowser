// Copyright 2026 The JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_WEBUI_JAH_HOME_JAH_HOME_UI_H_
#define CHROME_BROWSER_UI_WEBUI_JAH_HOME_JAH_HOME_UI_H_

#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "content/public/common/url_constants.h"

class JahHomeUI;

// WebUIConfig for the JahBrowser custom new tab page (chrome://jah-home).
// Registered in chrome/browser/ui/webui/chrome_web_ui_configs.cc and pointed to
// as the New Tab Page target in chrome/browser/search/search.cc.
class JahHomeUIConfig : public content::DefaultWebUIConfig<JahHomeUI> {
 public:
  JahHomeUIConfig();
};

// WebUIController that serves the static JahBrowser home page. The page is
// fully self-contained (tokens + styles + script inlined) and is served
// directly from a request filter, so no grit/build_webui pipeline is required.
//
// TODO(jah): Wire live channel / follow-list data through a Mojo PageHandler
// backed by the jah-core live-status service (dev.kick.com public API).
class JahHomeUI : public content::WebUIController {
 public:
  explicit JahHomeUI(content::WebUI* web_ui);
  JahHomeUI(const JahHomeUI&) = delete;
  JahHomeUI& operator=(const JahHomeUI&) = delete;
  ~JahHomeUI() override;
};

#endif  // CHROME_BROWSER_UI_WEBUI_JAH_HOME_JAH_HOME_UI_H_
