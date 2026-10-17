Event placeholder images
========================

The eight photographs in this folder are used as the `events.image_url` values
for the seeded charity events (for example `/images/funrun.jpg`).

Source
------
Royalty-free photographs from Unsplash (https://unsplash.com), downloaded and
stored locally so the website does not depend on a third-party image host at
demonstration or marking time. The Unsplash licence permits free commercial and
non-commercial use without attribution; the credits below are given anyway.

| File | Used by | Subject | Source |
|---|---|---|---|
| funrun.jpg | City Fun Run 2026 | Runners at dawn | https://unsplash.com/photos/photo-1552674605-db6ffd4facb5 |
| gala.jpg | Hope Gala Dinner | Formal event table setting | https://unsplash.com/photos/photo-1519671482749-fd09be7ccebf |
| auction.jpg | Silent Auction Night | Auction room interior | https://unsplash.com/photos/photo-1561214115-f2f134cc4912 |
| concert.jpg | Charity Rock Concert | Festival crowd | https://unsplash.com/photos/photo-1501386761578-eac5c94b800a |
| beachrun.jpg | Beach Cleanup Run | Beach shoreline | https://unsplash.com/photos/photo-1507525428034-b723cf961d3e |
| wintergala.jpg | Winter Gala 2026 | Restaurant dining room | https://unsplash.com/photos/photo-1414235077428-338989a2e8c0 |
| artauction.jpg | Art for Hope Auction | Artist painting | https://unsplash.com/photos/photo-1513364776144-60967b0f800f |
| jazz.jpg | Jazz for Health | Live musicians | https://unsplash.com/photos/photo-1415201364774-f6f0bb35f28f |

Note on the Assessment 2 files
------------------------------
The Assessment 2 submission contained eight files named `*.jpg` whose bytes were
actually WebP images (a mislabelled extension), and the subjects did not match
the events they were assigned to - for example the "City Fun Run" card displayed
an off-road buggy. They have therefore been replaced with the correct formats and
topical subjects listed above.

The schema and the code need no change either way: `image_url` stores a plain
path or a full URL, and the front end already falls back to a generated gradient
placeholder when an image is missing, so an absent or broken file never shows a
broken-image icon.
