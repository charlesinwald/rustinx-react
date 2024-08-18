import React from "react";
import "./Sidebar.css";
import NginxStatus from "../Status/Status";

function Sidebar({ links, onLinkClick, currentView }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Rustinx</h2>
        <nav>
          <ul className="sidebar-list">
            {links.map((link, index) => (
              <li
                key={index}
                className={`sidebar-item ${
                  currentView === link.view ? "active" : ""
                }`}
              >
                <button
                  className="sidebar-link"
                  onClick={() => onLinkClick(link)}
                >
                  {link.label} 
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <NginxStatus />
    </div>
  );
}

export default Sidebar;
