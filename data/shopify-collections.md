# LEGO Philippines — Shopify Collections

50 smart (automated) collections created via `scripts/shopify-create-collections.js`,
one per distinct `Type` value in `data/shopify-import-lego-merged.csv`. Each collection's
rule is "Product type equals `<type>`", so future products of that type join
automatically.

Full result log: `data/shopify-collections-log.csv`.

## Collections

1. Architecture
2. Art
3. ART
4. Bags
5. Bluey
6. Botanicals
7. Chinese Festivals
8. City
9. City Big Vehicles
10. City Exploration
11. City Police
12. City Trains
13. Classic
14. Creator 3 in 1
15. Disney Classic
16. Disney Junior
17. Disney Pixar
18. Disney Princess
19. Duplo
20. DUPLO
21. DUPLO Bluey
22. DUPLO Disney TM
23. DUPLO My First
24. DUPLO Peppa Pig
25. DUPLO Town
26. Editions Sports
27. Editions Vehicles
28. Fortnite
29. Friends
30. Gabby's Dollhouse
31. Harry Potter
32. Iconic
33. Icons
34. Ideas
35. Jurassic World
36. LEL Seasons and Occasions
37. Minecraft
38. Minifigures
39. Ninjago
40. One piece
41. Seasons and Occasions
42. Shrek
43. Sonic
44. Speed Champions
45. Spidey
46. Starwars
47. Super Heroes
48. Super Mario
49. Technic
50. Wicked

## Known data-quality note

A few entries are near-duplicates from inconsistent `Type` casing/naming in the
source data, kept as separate collections rather than silently merged:

- `Duplo` / `DUPLO` / `DUPLO Town` / `DUPLO Bluey` / `DUPLO Disney TM` /
  `DUPLO My First` / `DUPLO Peppa Pig`
- `Art` / `ART`

Consolidate these in Admin if a single "Duplo" and single "Art" collection is
preferred over the split.
