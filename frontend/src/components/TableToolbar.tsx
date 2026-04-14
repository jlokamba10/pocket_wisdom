import { ReactNode } from "react";

type TableToolbarProps = {
  children: ReactNode;
};

export default function TableToolbar({ children }: TableToolbarProps) {
  return <div className="table-toolbar">{children}</div>;
}
