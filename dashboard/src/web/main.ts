import { mount } from "svelte";
import App from "@app-entry";
import "./styles/web.css";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("App root not found");
}

mount(App, {
  target: root
});
