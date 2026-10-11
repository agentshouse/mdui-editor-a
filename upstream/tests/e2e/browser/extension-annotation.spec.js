/*!
Copyright 2012-2026 Sarven Capadisli <https://csarven.ca/>
Copyright 2023-2026 Virginia Balseiro <https://virginiabalseiro.com/>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { extensionTest as test, expect } from "./fixtures";

test.describe.configure({ timeout: 180000 });
test.beforeEach(({}, testInfo) => testInfo.setTimeout(180000));

test.beforeEach(async ({ extensionAuth }) => {
  if (!process.env.IDP || !process.env.WEBID || !process.env.LOGIN_ID || !process.env.LOGIN_PASSWORD) {
    test.skip(true, "Set IDP, WEBID, LOGIN_ID, LOGIN_PASSWORD in .env");
  }
  await extensionAuth.login();
});

test("create annotation, see it in notifications, delete it", async ({ context, page }) => {
  const [sw] = context.serviceWorkers();
  const tabId = await sw.evaluate(async (url) => {
    const [t] = await chrome.tabs.query({ url });
    return t.id;
  }, page.url());

  await page.evaluate(() => {
    const p = document.querySelector("article p");
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.locator("#document-editor")).toBeVisible({ timeout: 10000 });

  const noteText = `e2e test ${Date.now()}`;
  await page.click("#editor-button-comment");
  await expect(page.locator("textarea#comment-content")).toBeVisible();
  await page.fill("textarea#comment-content", noteText);
  await page.locator("#editor-form-comment button.editor-form-submit").click();

  const refLink = page.locator("sup.ref-annotation").last();
  await expect(refLink).toBeVisible({ timeout: 20000 });

  await sw.evaluate(async ({ id, cls }) => {
    await chrome.tabs.sendMessage(id, { action: "dokieli.menuClick", className: cls });
  }, { id: tabId, cls: "resource-notifications" });
  await expect(page.locator("#document-notifications")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#document-notifications")).toContainText(noteText, { timeout: 30000 });

  await refLink.click();
  await page.click("button.delete");
  await expect(page.locator("sup.ref-annotation", { hasText: noteText })).toHaveCount(0, { timeout: 10000 });
});
