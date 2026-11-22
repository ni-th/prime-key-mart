"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { categoryPath } from "@/lib/category-url";

type Category = { slug: string; name: string };

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

export function CatalogFilters({
  categories,
  brands,
  activeCategory,
}: {
  categories: Category[];
  brands: string[];
  /** Slug of the category page being shown, or null on "All products". */
  activeCategory: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const current = {
    category: activeCategory ?? "all",
    brand: params.get("brand") ?? "all",
    sort: params.get("sort") ?? "featured",
    q: params.get("q") ?? "",
  };
  const hasFilters =
    current.category !== "all" ||
    current.brand !== "all" ||
    current.sort !== "featured" ||
    current.q !== "";

  // The category is part of the path (/category/x); everything else is a
  // query param that carries over when switching category.
  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      next.delete("category");
      let category = activeCategory;
      if (key === "category") category = !value || value === "all" ? null : value;
      else if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      const base = category ? categoryPath(category) : "/products";
      router.push(next.toString() ? `${base}?${next}` : base);
    },
    [params, router, activeCategory],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* `items` gives each Select its labels up front, so the trigger shows
          "Operating Systems" instead of the raw value ("operating-systems"). */}
      <Select
        value={current.category}
        onValueChange={(v) => update("category", v)}
        items={[
          { value: "all", label: "All categories" },
          ...categories.map((c) => ({ value: c.slug, label: c.name })),
        ]}
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.slug} value={c.slug}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.brand}
        onValueChange={(v) => update("brand", v)}
        items={[
          { value: "all", label: "All brands" },
          ...brands.map((b) => ({ value: b, label: b })),
        ]}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All brands</SelectItem>
          {brands.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.sort}
        onValueChange={(v) => update("sort", v)}
        items={SORTS}
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/products")}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
