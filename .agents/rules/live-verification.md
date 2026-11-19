# Live Verification Rule

Always verify deployed changes yourself on the live production site before concluding any task:
1. After pushing any changes or fixes, never assume they work or are already deployed.
2. Poll or check the live site (using a headless browser, CDP, or automated verification script) to ensure the latest commit is actually deployed and active on the hosting platform (e.g., Cloudflare Pages).
3. Test the exact user flows, interactions, and controls directly against the live production URL.
4. Verify all edge cases (resolutions, audio tracks, failover guards, and console errors).
5. Capture concrete proof (state inspections, network response status, logs, or screenshots) confirming that the feature is functioning correctly on the live deployment before reporting completion to the user.
