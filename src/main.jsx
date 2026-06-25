import React from "react";
import { createRoot } from "react-dom/client";
import BurgerBike from "./BurgerBike.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BurgerBike />
  </React.StrictMode>
);
