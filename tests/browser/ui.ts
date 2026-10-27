import type { Page } from '@playwright/test';
export async function disclose(page: Page, selector: string) {
  const details = page.locator(selector);
  if ((await details.getAttribute('open')) === null)
    await details.locator(':scope > summary').click();
}
export async function chooseSimulation(page: Page, channel: string) {
  await disclose(page, '.title-accounts');
  await page.getByRole('button', { name: `Use simulation ${channel}`, exact: true }).click();
}
