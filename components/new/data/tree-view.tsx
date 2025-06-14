import React, { useState } from 'react';

type TreeNode = {
  label: string;
  children?: TreeNode[];
};

type TreeViewProps = {
  data: TreeNode[];
  className?: string;
};

const TreeView: React.FC<TreeViewProps> = ({ data, className }) => {
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (path: string) => {
    setOpenNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (nodes: TreeNode[], path = ''): React.ReactNode => (
    <ul className="pl-4 border-l border-gray-200">
      {nodes.map((node, idx) => {
        const nodePath = path ? `${path}-${idx}` : `${idx}`;
        const hasChildren = node.children && node.children.length > 0;
        return (
          <li key={nodePath} className="mb-1">
            <div className="flex items-center gap-1">
              {hasChildren && (
                <button
                  onClick={() => toggleNode(nodePath)}
                  aria-label={openNodes[nodePath] ? 'Colapsar' : 'Expandir'}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 focus:outline-none"
                  tabIndex={0}
                >
                  {openNodes[nodePath] ? '-' : '+'}
                </button>
              )}
              <span>{node.label}</span>
            </div>
            {hasChildren && openNodes[nodePath] && node.children && renderTree(node.children, nodePath)}
          </li>
        );
      })}
    </ul>
  );

  return <div className={className}>{renderTree(data)}</div>;
};

export default TreeView; 