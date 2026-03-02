"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
    /** Google profile picture URL (or null/undefined) */
    src?: string | null;
    /** Alt text for the image */
    alt?: string;
    /** User name — first character used as fallback initial */
    name?: string | null;
    /**
     * Shared classes applied to both the <img> and the fallback <div>.
     * Use for sizing, rounding, border, shadow, etc.
     */
    className?: string;
    /**
     * Extra classes for the fallback <div> only (e.g. background color).
     * Default: `"bg-gradient-to-br from-meteorite-200 to-meteorite-300 text-meteorite-700"`
     */
    fallbackClassName?: string;
    /** Custom fallback content (icon, etc.) instead of the auto-generated initial */
    fallbackIcon?: React.ReactNode;
}

/**
 * Centralized avatar component that:
 * - Always sets `referrerPolicy="no-referrer"` (fixes Google CDN blocking)
 * - Gracefully falls back to initials or a custom icon when the image fails or is missing
 * - Provides consistent styling across the app
 */
export function UserAvatar({
    src,
    alt = "",
    name,
    className,
    fallbackClassName,
    fallbackIcon,
}: UserAvatarProps) {
    const [imgError, setImgError] = useState(false);

    const initials = (name?.charAt(0) ?? "?").toUpperCase();

    // Fallback: no src, or image failed to load
    if (!src || imgError) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center font-bold",
                    fallbackClassName ?? "bg-gradient-to-br from-meteorite-200 to-meteorite-300 text-meteorite-700",
                    className
                )}
            >
                {fallbackIcon ?? <span>{initials}</span>}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={cn("object-cover", className)}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
        />
    );
}
