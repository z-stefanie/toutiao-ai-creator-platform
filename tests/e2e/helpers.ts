import { expect, type Page } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /今天从一条可发布链路开始/ })).toBeVisible();
}

export async function generateDraft(page: Page, topic: string) {
  await page.goto('/create');
  await page.getByRole('textbox', { name: '主题' }).fill(topic);
  await expect(page.getByText('city-workspace.svg · passed')).toBeVisible();
  await page.getByRole('button', { name: '生成草稿' }).click();
  await expect(page).toHaveURL(/\/editor\/draft_/);
  await expect(page.getByRole('heading', { name: '图文编辑器' })).toBeVisible();
}

export function draftIdFromUrl(page: Page) {
  const match = page.url().match(/\/editor\/([^/?#]+)/);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}
