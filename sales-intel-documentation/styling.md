# Styling: the knobs, and where they live

Everything visual in this app is one of two things: a **colour variable** in
`app/globals.css`, or a **class name** on an element. Nothing is hidden in a build step,
there is no theme package to learn, and the dev server reloads the moment you save.

Work in `D:\sales-intel-deploy` with `npm run dev` running. Change, save, look at the browser.

**If you break something**, throw the file away and start again:

```
git checkout -- app/page.tsx
```

That restores the last committed version of that one file. It is the undo button, and it is
why committing before a styling session is worth the ten seconds.

---

## 1. Colours: `app/globals.css`

The whole palette is nine values at the top of the file:

```css
:root {
  --background: #10121a;   /* the page behind everything */
  --raised: #171a24;       /* the terminal card sitting on it */
  --foreground: #ecedf3;   /* normal text */
  --line: #262a38;         /* every border and divider */
  --muted: #8b90a3;        /* secondary text */
  --dim: #565b6e;          /* the quietest text, timestamps and hints */
  --accent: #5fbf8e;       /* terminal green: headings, buttons, links */
  --accent-dim: #2e6b52;   /* the green used for borders and scrollbars */
  --accent2: #5fa8d3;      /* blue: the // section labels */
}
```

Change `--accent` to `#d97706` and every green thing in the app turns amber at once, because
nothing anywhere hardcodes a colour. That is the whole trick, and it is also why offering a
customer their own brand colours is a five-minute job rather than a fork.

Keep the *relationships* when you change these. `--background` must stay darker than
`--raised`, and `--dim` quieter than `--muted` quieter than `--foreground`. Break that and the
depth of the interface collapses even though every individual colour is fine.

The two glows behind the page are lower down in the same file, in `body { background-image: }`.
They are two big soft radial gradients, one warm at the top left, one blue at the top right.
The last number in each `rgba(...)` is opacity: `0.07` is barely there, `0.2` is obvious.

### How a colour reaches an element

The `@theme inline` block just below turns each variable into a Tailwind class name:

| Variable | Classes you will see in the code |
| --- | --- |
| `--accent` | `text-accent`, `bg-accent`, `border-accent` |
| `--muted` | `text-muted` |
| `--dim` | `text-dim` |
| `--line` | `border-line`, `divide-line` |
| `--raised` | `bg-raised` |

So `className="text-accent"` means "this text uses `--accent`". You will not find a hex code
anywhere else in the app, and you should not add one.

---

## 2. The knobs you are most likely to want

### The desk (`app/page.tsx`)

**How tall the three panes are.** On the grid:

```
lg:h-[30rem]
```

`30rem` is 480 pixels. Make it `34rem` for taller panes showing more contacts at once, `26rem`
for a tighter screen. Everything else follows automatically, because all three panes are told
to fill this row and scroll whatever does not fit.

**How wide each pane is.** Same line:

```
lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]
```

Three columns. The first is a fixed `14rem` (the prospects pane). The other two share what is
left in a ratio of `1.1` to `1`, so contacts is slightly wider than deals. Make it `1.4fr` and
`1fr` to give contacts much more room. The underscores are just how Tailwind writes spaces
inside brackets.

**How tall each prospect row is.** `min-h-[4.75rem]`, on both the filled row and the empty
slot. Change both together or the five stop matching, which is the whole point of them.

**How wide the page is.** `maxWidthClassName="max-w-[1800px]"` on `TerminalShell`. The same
prop is on the companies and deals pages.

### The list pages (`app/companies/page.tsx`, `app/deals/page.tsx`)

`fillViewport` on `TerminalShell` is what makes them exactly one screen tall. Remove that one
word and the page grows with its content like a normal web page instead.

### The scrollbars (`app/globals.css`)

The `.scroll-pane` block near the bottom. `width: 8px` is the rail thickness,
`background: var(--accent-dim)` its colour. Delete the whole block and you get your operating
system's normal scrollbars back.

### The deal summaries (`components/DealBoard.tsx`)

`line-clamp-3` on the reasoning paragraph. That is how many lines of the analysis show before
it cuts off. `line-clamp-2` for a tighter list, `line-clamp-none` for all of it.

---

## 3. Reading a class name

Class names are read left to right and each one does a single thing:

```
mt-3 flex flex-col gap-2 rounded border border-line px-3 py-2 text-sm text-muted
```

- `mt-3` margin on top. The number is a step on a 4-pixel scale, so `mt-3` is 12px,
  `mt-6` is 24px. `mb-` bottom, `mx-` sides, `my-` top and bottom.
- `px-3 py-2` padding inside, sides then top-and-bottom. Same scale.
- `flex flex-col gap-2` lay the children out in a column with a gap between them.
- `rounded` corners, `border border-line` a one-pixel border in the line colour.
- `text-sm` size. The ladder is `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`,
  `text-2xl`.
- `text-muted` colour, from the table above.

**Prefixes change when a rule applies.** `lg:h-[30rem]` means "only on screens above roughly
1024px wide". `hover:text-accent` means "when the mouse is over it". `sm:block` means "visible
from small screens up". Anything without a prefix always applies.

**Square brackets mean an exact value** where the scale does not have what you want.
`h-[30rem]`, `max-w-[1800px]`, `min-h-[4.75rem]`. Use the scale when you can and brackets when
you must.

---

## 4. The one thing that will bite you

The scrolling panes work because of a chain that has to stay intact:

```
the grid has a fixed height          lg:h-[30rem]
  the pane is a flex column          flex min-h-0 flex-col
    its header does not shrink       shrink-0
    its list takes the rest          min-h-0 flex-1 overflow-y-auto
```

**`min-h-0` is the load-bearing one.** A flex child refuses to shrink below its own content
unless you tell it it may, so removing `min-h-0` makes the list push the pane taller instead of
scrolling, and the whole layout quietly goes back to how it was before. If a pane stops
scrolling after you edited it, that is almost always what happened.

Fonts, colours, spacing and sizes are safe to play with. The four class names above are
structure, not styling.

---

## 5. Where the fonts come from

`app/layout.tsx`, three of them: Space Grotesk for headings (`font-display`), JetBrains Mono
for anything terminal-flavoured (`font-mono`), Inter for body text (`font-sans`). They load
from Google Fonts at build time. Swapping one means changing the import and the variable name
in `globals.css` together, which is a bigger job than the rest of this page and worth doing
with help the first time.
