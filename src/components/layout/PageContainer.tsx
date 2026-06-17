import React from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  description,
  action,
  children,
}) => {
  return (
    <div className="page-container">
      <div className="page-header-row">
        <div className="page-header-left">
          <h1 className="page-title-text">{title}</h1>
          {description && <p className="page-subtitle-text">{description}</p>}
        </div>
        {action && <div className="page-header-right">{action}</div>}
      </div>
      <div className="page-content-wrapper">
        {children}
      </div>
    </div>
  );
};

export default PageContainer;
