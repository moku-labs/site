import { createIsland } from "@moku-labs/web/browser";

export const likeButton = createIsland("like-button", {
  state: () => ({ count: 0 }),
  render: state => <button type="button">{state.count}</button>
});
