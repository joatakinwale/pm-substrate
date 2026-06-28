const fs = require('fs');

let content = fs.readFileSync('frontend/src/app/admin/page.tsx', 'utf8');

content = content.replace(
  'dashboardIntro: string | null;',
  'dashboardIntro: string | null;\n  inboxItems: any[];'
);

content = content.replace(
  'settingsData,\n      ] = await Promise.all([',
  'settingsData,\n        inboxData,\n      ] = await Promise.all(['
);

content = content.replace(
  'safe(apiFetch<OrganizationSettings>("/api/settings")),',
  'safe(apiFetch<OrganizationSettings>("/api/settings")),\n        safe(apiFetch<any>("/api/virtual-agency/inbox")),'
);

content = content.replace(
  'dashboardIntro: intro && intro.trim() ? intro : null,',
  'dashboardIntro: intro && intro.trim() ? intro : null,\n        inboxItems: inboxData?.items ?? [],'
);

content = content.replace(
  'const upcomingBookings = data?.upcomingBookings ?? [];',
  'const upcomingBookings = data?.upcomingBookings ?? [];\n  const inboxItems = data?.inboxItems ?? [];'
);

content = content.replace(
  'Here&apos;s what&apos;s happening with your leads and bookings.',
  'Here&apos;s your Virtual Agency inbox and what&apos;s happening with your leads.'
);

const newInboxComponent = `
      {/* Agent Inbox */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-8 border-l-4 border-l-stevie-lavender">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Agent Inbox</h2>
          <span className="text-sm bg-stevie-lavender/20 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            {inboxItems.length} Pending Approvals
          </span>
        </div>
        {loading ? (
          <div className="h-10 bg-gray-50 rounded animate-pulse" />
        ) : inboxItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>You\\'re all caught up!</p>
            <p className="mt-1">No proposals or tasks currently need your approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Proposed by {item.agent} • {item.type}</p>
                </div>
                <button className="text-sm bg-black text-white px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors">
                  Review & Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
`;

content = content.replace(
  '{/* Stat cards */}',
  newInboxComponent + '\n      {/* Stat cards */}'
);

fs.writeFileSync('frontend/src/app/admin/page.tsx', content);
