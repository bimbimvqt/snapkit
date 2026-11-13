# macOS permissions

Snapkit keeps startup passive. Notifications are enabled only through the bell's
notification settings. Device discovery starts when a device feature is opened
or the user requests a scan; subsequent background scans keep that list current.
Setup diagnostics run when the user opens Setup & tools or requests a check.
SDK discovery uses known local paths and configured environment/PATH entries;
it does not enumerate mounted disks. Select an external SDK folder explicitly
in settings. Desktop folder selection uses Electron's native directory dialog;
the local browser agent retains its explicit folder-picker fallback.

Previously saved notification choices and SDK paths remain in place. A real
notification or an explicitly invoked device/SDK operation can still cause an
OS permission prompt if macOS has not granted that permission to this binary.

## Permissions after updates

Public macOS builds currently use ad-hoc signing (`identity: "-"`). Ad-hoc signing
has no stable Developer ID certificate, so macOS can invalidate an earlier
permission grant when the executable changes. Application preferences cannot
replace or restore a macOS privacy grant. This release reduces unnecessary
requests; it does not guarantee that grants survive an update.

To make release identity stable, enroll in Apple Developer, obtain a
**Developer ID Application** certificate, and configure the release workflow to
sign all supported macOS artifacts with that identity. Keep `dev.snapkit.desktop`
as the bundle identifier and use the same signing team across releases. Enable
hardened runtime with the Electron entitlements required by the shipped runtime,
then notarize and staple the distribution. Verify an upgrade from one signed
release to the next on a real Mac, including notifications, local network and
folder access. Existing ad-hoc users may need to grant permissions once when
moving to the first Developer ID release.

Do not reset TCC, modify its database, or treat a localStorage flag as evidence
of an OS permission grant. Do not use an Apple Development certificate as a
substitute for Developer ID in public releases.
