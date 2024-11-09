import { performAuthRedirection } from "./helper"

let mainControls = document.querySelector('div.il-layout-page')?.querySelector('ul.il-maincontrols-metabar') || null;
if (mainControls !== null && mainControls.querySelector('span.il-avatar') === null) {
    performAuthRedirection();
}