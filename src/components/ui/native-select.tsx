import { cn } from "@/lib/utils";
import { TEXT_SIZE } from "@/lib/typography";
import * as React from "react";
import { FieldChromeProps, FieldFrame, useFieldId } from "./field";

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & FieldChromeProps;

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      className,
      id,
      children,
      label,
      labelClassName,
      hint,
      hintClassName,
      labelAction,
      fieldClassName,
      suffix,
      ...props
    },
    ref,
  ) => {
    const selectId = useFieldId(id, label);
    const control = (
      <select
        id={selectId}
        className={          cn(
            "h-9 w-full rounded-xs bg-white px-3 text-text-secondary shadow-soft transition-[box-shadow,background-color] duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
            TEXT_SIZE.sm,
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );

    return (
      <FieldFrame
        id={selectId}
        label={label}
        labelClassName={labelClassName}
        hint={hint}
        hintClassName={hintClassName}
        labelAction={labelAction}
        fieldClassName={fieldClassName}
        suffix={suffix}
      >
        {control}
      </FieldFrame>
    );
  },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
