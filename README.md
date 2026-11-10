# Public bulletin catalog

This repository contains only the public bulletin index and its refresh task.
The index links to the original publicly listed Kakao bulletin images, in their
original order. It does not host the image files, post text, the website
application, or any member information.

The refresh runs hourly and commits only when the catalog changes. If the
source response changes shape, validation fails and the last published index
remains untouched.
