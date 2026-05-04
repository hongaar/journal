import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageBackButtonProps = {
  className?: string;
};

export function PageBackButton({ className }: PageBackButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={buttonVariants({
        variant: "secondary",
        size: "sm",
        className: cn(
          "inline-flex gap-1.5 rounded-xl border-0 bg-foreground/5 shadow-sm hover:bg-foreground/10",
          className,
        ),
      })}
      onClick={() => navigate(-1)}
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}
