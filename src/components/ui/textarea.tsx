import { cn } from "@/lib/utils";
import { TEXT_SIZE } from "@/lib/typography";
import * as React from "react";
import { FieldChromeProps, FieldFrame, useFieldId } from "./field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldChromeProps;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
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
    const textareaId = useFieldId(id, label);
    const control = (
      <textarea
        id={textareaId}
        className={          cn(
            "flex min-h-[96px] w-full rounded-xs bg-white/92 px-3 py-2.5 shadow-soft placeholder:text-text-subtle transition-[box-shadow,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
            TEXT_SIZE.sm,
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    return (
      <FieldFrame
        id={textareaId}
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
Textarea.displayName = "Textarea";

export { Textarea };
