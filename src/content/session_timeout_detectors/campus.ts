import { performAuthRedirection } from "./helper";

let userInfo = document.querySelector('div#user-info');

if (userInfo !== null && userInfo.querySelector('a.ui-login') !== null) {
    performAuthRedirection();
}