const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const siteNavigation = document.querySelector<HTMLElement>("[data-navigation]");
const header = document.querySelector<HTMLElement>("[data-site-header]");

if (toggle && siteNavigation && header) {
  const setMenuState = (isOpen: boolean): void => {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Zamknij menu" : "Otwórz menu");
    header.classList.toggle("is-menu-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
  };

  toggle.addEventListener("click", () => {
    setMenuState(toggle.getAttribute("aria-expanded") !== "true");
  });

  siteNavigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenuState(false);
      toggle.focus();
    }
  });

  const desktopMedia = window.matchMedia("(min-width: 64rem)");
  desktopMedia.addEventListener("change", (event) => {
    if (event.matches) {
      setMenuState(false);
    }
  });
}
