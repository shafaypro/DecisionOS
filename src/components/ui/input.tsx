import { cn } from "@/lib/utils";
import { TEXT_SIZE } from "@/lib/typography";
import * as React from "react";
import { FieldChromeProps, FieldFrame, useFieldId } from "./field";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & FieldChromeProps;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      id,
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
    const inputId = useFieldId(id, label);
    const control = (
      <input
        type={type}
        id={inputId}
        className={          cn(
            "flex h-10 w-full rounded-xs bg-white/92 px-3 py-2 shadow-soft transition-[box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:font-medium placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
            TEXT_SIZE.sm,
          suffix && "min-w-0 flex-1",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    return (
      <FieldFrame
        id={inputId}
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
Input.displayName = "Input";

export { Input };
