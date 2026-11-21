# Public bulletin catalog

This repository contains only the public bulletin index and its refresh task.
The index links to the original publicly listed Kakao bulletin images, in their
original order. It does not host the image files, post text, the website
application, or any member information.

The refresh is scheduled hourly, with a second scheduled check on UTC Sunday
and Monday to cover the local Sunday release window. GitHub may delay scheduled
runs; `workflow_dispatch` is available for an immediate catch-up. It commits
only when the catalog changes. Public dated `주보` entries and the shortened
Sunday-only `주` title are accepted only with validated image pages. Page order
is preserved. The title identifies the service date, not the posting date:
already-public Sunday bulletins up to seven days ahead of the Los Angeles date
are included on the next successful refresh. Scheduled or unlisted posts and
distant future dates are not included. If validation fails, the last published
index remains untouched.
