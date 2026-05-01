import React from "react";

function PageTransition({ children, transition }) {
  return (
    <div className="page-transition" data-transition={transition || "default"}>
      {children}
    </div>
  );
}

export default PageTransition;
