// Copyright 2026 The JahBrowser Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/webui/jah_home/jah_home_ui.h"

#include <string>

#include "base/functional/bind.h"
#include "base/memory/ref_counted_memory.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace {

// The complete, self-contained new tab page (HTML + inline CSS + inline JS).
// Kept in its own file so it stays human-editable; embedded here as a raw
// string literal so no grit resource pipeline is needed.
constexpr char kJahHomePage[] =
#include "chrome/browser/ui/webui/jah_home/resources/jah_home_page.inc"
    ;  // NOLINT(whitespace/semicolon)

// Serve the single page for every request path (the page references no
// external sub-resources).
bool ShouldHandleJahHomeRequest(const std::string& path) {
  return true;
}

void HandleJahHomeRequest(const std::string& path,
                          content::WebUIDataSource::GotDataCallback callback) {
  std::move(callback).Run(
      base::MakeRefCounted<base::RefCountedString>(std::string(kJahHomePage)));
}

}  // namespace

JahHomeUIConfig::JahHomeUIConfig()
    : DefaultWebUIConfig(content::kChromeUIScheme,
                         chrome::kChromeUIJahHomeHost) {}

JahHomeUI::JahHomeUI(content::WebUI* web_ui) : content::WebUIController(web_ui) {
  content::BrowserContext* browser_context =
      web_ui->GetWebContents()->GetBrowserContext();
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      browser_context, chrome::kChromeUIJahHomeHost);

  source->SetRequestFilter(
      base::BindRepeating(&ShouldHandleJahHomeRequest),
      base::BindRepeating(&HandleJahHomeRequest));

  // The page uses inline <style>/<script> and assigns to Element.innerHTML.
  // Relax the default Trusted-WebUI CSP accordingly for this first-party page.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
  source->DisableTrustedTypesCSP();
}

JahHomeUI::~JahHomeUI() = default;
