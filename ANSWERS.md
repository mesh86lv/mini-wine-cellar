# Part 2 — Written answers

## 1. How would you add login with AWS Cognito and Amplify?

I would create a Cognito user pool with an app client that has no secret, because a browser cannot
keep one. On the web side Amplify Auth handles sign-in and session refresh, and for the App Router I
would add the Amplify Next.js adapter so the tokens live in cookies and the server can read them
too. Apollo already builds the request headers in one place, so the only change on the client is
that the link sends `Authorization: Bearer <access token>` instead of `x-user-id`. On the API a Nest
guard verifies the token with `aws-jwt-verify` (issuer, client id and token use) and maps the `sub`
claim to a new unique column on `User`, creating the user on first login; the rest of the server
does not change, because every resolver already takes the owner from `@CurrentUser()`.

## 2. How would you implement image upload to S3?

I would keep the file out of the API and use presigned URLs. A mutation asks for an upload slot,
checks the caller and allows only jpeg, png and webp up to a size limit, and returns a presigned
request plus a key such as `users/{userId}/bottles/{uuid}.jpg`. The browser uploads straight to a
private bucket that has CORS configured for the web origin, and then `addBottle` saves the key
instead of a link. Images are served through CloudFront or through short-lived presigned GET URLs,
so the bucket stays private, and a lifecycle rule removes uploads that were never attached to a
bottle. If the originals are too large, an S3 event can trigger a small resizing function.

## 3. How would you add chat between users with Stream?

The Stream secret must stay on the server, so the API owns the Stream server SDK and creates the
users there. It exposes a query that returns a chat token for the authenticated user, and it upserts
that user in Stream on login so the two sides always agree on the id and the name. The web app uses
`stream-chat-react`, connects with a token provider so an expired token can be refreshed, and opens
a `messaging` channel with two members, using an id built from the sorted user ids so both sides
always land in the same conversation. Permissions are limited to the channel members, and a webhook
can drive notifications later. The browser never sees the API secret.

## 4. How do you make schema changes on a live platform safely?

I use the expand/contract pattern, so that during a release both the old and the new code can work
with the same database. A migration is reviewed like code, tried on a copy of production-like data,
and run as one controlled step before the new version is deployed. To keep locks short I add new
columns as nullable, backfill in small batches, add constraints only when the data is clean, and
create indexes concurrently; I never rename or drop something in the same release that stops using
it. Before a risky change I check that backups and point-in-time recovery work, and I have either a
rollback path or a forward fix ready. After the release I watch errors and database metrics instead
of assuming it went well.

## 5. How do you review AI-written code before merging it?

I review it the way I review a pull request from a new teammate: I read every line and I only merge
what I can explain to somebody else. I run it locally together with the linter, the type check and
the tests, and I compare the behaviour with the requirements and with the agreed scope. My focus is
on authorization and ownership checks, input validation, secrets, invented libraries or APIs, N+1
queries and error handling. If a behaviour is not covered by a test, I ask for the test in the same
change, and I split large diffs before reviewing them.
