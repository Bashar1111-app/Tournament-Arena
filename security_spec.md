# FC Tournament Manager Security Specification

## Data Invariants
1. A participant must belong to a valid tournament.
2. Only admins or the tournament creator can modify tournament details.
3. Participants can only register themselves (ownerId check).
4. Match scores can only be updated by admins.
5. Once a match is 'completed', its scores are immutable (except by admin).
6. Tournament status transitions: upcoming -> ongoing -> completed.

## The Dirty Dozen Payloads (Rejection Targets)
1. **Unauthenticated Write**: Attempting to create a tournament without being signed in.
2. **Identity Spoofing**: Participant registering with a `userId` that doesn't match `request.auth.uid`.
3. **Privilege Escalation**: Non-admin user attempting to create an entry in the `/admins` collection.
4. **Invalid State Transition**: Updating a tournament from 'completed' back to 'upcoming'.
5. **Orphaned Participant**: Creating a participant record for a non-existent tournament ID.
6. **Score Tampering**: Regular participant attempting to update match scores.
7. **Resource Poisoning**: Sending a 1MB string for a participant's `teamName`.
8. **Shadow Field Injection**: Adding an `isAdmin: true` field to a participant document.
9. **Timeline Fraud**: Client providing a `createdAt` timestamp from 2010.
10. **Membership Bypass**: Reading match details for a private tournament the user isn't part of (if applicable, though our current rules are open read).
11. **Mass Deletion**: Attempting to delete the entire `tournaments` collection.
12. **Admin Lockout**: Regular user attempting to remove an admin from the `/admins` collection.

## Test Strategy
- Use `firestore.rules.test.ts` to simulate these payloads.
- Ensure all 12 return `PERMISSION_DENIED`.
