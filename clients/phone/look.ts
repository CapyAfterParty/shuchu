// Presentation only: when a thought is caught, its words drift up and
// melt into the mist while the box is already empty for the next one.

const form = document.querySelector<HTMLFormElement>("#capture")!;

form.addEventListener("caught", (event) => {
  const ghost = document.createElement("span");
  ghost.className = "ghost";
  ghost.textContent = (event as CustomEvent<string>).detail;
  form.append(ghost);
  ghost.addEventListener("animationend", () => ghost.remove());

  form.classList.remove("flare");
  void form.offsetWidth;
  form.classList.add("flare");
});
