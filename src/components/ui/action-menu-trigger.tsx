import { Loader2, MoreVertical } from "lucide-react";
import * as React from "react";
import type { MouseEventHandler } from "react";

import { Button } from "./button";

type ActionMenuTriggerProps = {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const ActionMenuEllipsis = React.forwardRef<HTMLButtonElement, ActionMenuTriggerProps>(
  function ActionMenuEllipsis({ label = "Open actions", disabled = false, loading = false, className, onClick }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="icon"
      className={`h-8 w-8 border border-border bg-transparent text-muted-foreground hover:text-foreground ${className ?? ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MoreVertical className="h-4 w-4" />
      )}
    </Button>
  );
  },
);

export { ActionMenuEllipsis };
