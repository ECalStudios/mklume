# Extras & Integrations

MkLume lets you configure additional features for your MkDocs Material site — analytics, social links, consent banners, and more — through a visual settings panel. These map to the `extra` and related sections in your `mkdocs.yml`.

## Google Analytics

Configure Google Analytics tracking for your documentation site.

| Setting | Description |
|---|---|
| Provider | The analytics provider (currently `google`) |
| Property | Your Google Analytics measurement ID (e.g., `G-XXXXXXXXXX`) |

!!! note "Analytics apply to your generated site only"
    Google Analytics tracking is added to the MkDocs site you build and publish. MkLume itself does **not** collect any analytics or telemetry data. This setting only affects what your visitors see when they browse your published documentation.

## Cookie consent

If you enable analytics or other tracking on your site, you can configure a cookie consent banner that appears for visitors.

| Setting | Description |
|---|---|
| Title | The heading shown on the consent banner |
| Description | Explanatory text about what cookies or tracking are used |
| Actions | The buttons available to visitors (e.g., accept, reject, manage) |

The consent banner is a built-in feature of MkDocs Material and respects visitors' choices.

## Social links

Add social media and external links to your site's footer. Each social link has three fields:

| Field | Description |
|---|---|
| Icon | A Material Design icon identifier (e.g., `fontawesome/brands/github`) |
| Link | The URL to link to |
| Name | A tooltip label shown on hover |

You can add multiple social links. They appear as icons in the footer of your built site.

## Generator toggle

MkDocs Material includes a small "Made with Material for MkDocs" notice in the site footer by default. You can toggle this on or off.

!!! tip
    The MkDocs Material project asks that you keep the generator notice enabled if you're using the free version. Consider leaving it on to support the project.

## Homepage URL

Set a custom homepage URL for your site. This controls where the logo and site title link to, which is useful if your documentation is part of a larger website.

## Alternate languages

If your documentation is available in multiple languages, you can configure alternate language versions here. Each entry specifies a language code, name, and link to the alternate version.

## MkLume credit

MkLume can optionally add a small credit line to your built site indicating it was created with MkLume. This is entirely optional and off by default.

## Custom extras

MkLume preserves any `extra` keys in your `mkdocs.yml` that it doesn't directly manage. If you've added custom variables, template overrides, or other extras by hand, they will remain intact when MkLume saves the file.

!!! info
    If you need to add custom `extra` values that aren't covered by the settings panel, edit your `mkdocs.yml` directly. MkLume won't remove or overwrite keys it doesn't recognize.
