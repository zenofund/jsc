import { Loader2, MoreVertical } from "lucide-react";
import * as React from "react";

import { Button } from "./button";
import { cn } from "./utils";

type ActionMenuEllipsisProps = Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
  label?: string;
  loading?: boolean;
};

const ActionMenuEllipsis = React.forwardRef<HTMLButtonElement, ActionMenuEllipsisProps>(
  function ActionMenuEllipsis(
    {
      label = "Open actions",
      loading = false,
      disabled = false,
      className,
      title,
      "aria-label": ariaLabel,
      ...buttonProps
    },
    ref,
  ) {
    return (
      <Button
        {...buttonProps}
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "h-8 w-8 border border-border bg-transparent text-muted-foreground hover:text-foreground",
          className,
        )}
        aria-label={ariaLabel ?? label}
        title={title ?? label}
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
