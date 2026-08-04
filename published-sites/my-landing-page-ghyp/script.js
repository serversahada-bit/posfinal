document.addEventListener("click", function(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const anchor = target.closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href") || "";
  if (href.startsWith("#")) {
    event.preventDefault();
  }
});