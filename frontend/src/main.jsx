import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { io } from "socket.io-client";
window.io = (url, opts) => io(url, opts);

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
