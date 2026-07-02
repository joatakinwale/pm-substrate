"""Stevie Social — SQLAlchemy models.

Import all models here so Alembic's `target_metadata` picks them up
and autogenerate works correctly.
"""
from app.models.base import Base, OrgMixin, TimestampMixin

# Foundation
from app.models.organization import Organization, PlanTier
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog

# Phase 1
from app.models.lead import Lead, QualificationStatus, RevenueRange
from app.models.booking import Booking, BookingProvider, BookingStatus
from app.models.booking_profile import BookingProfile, BookingProfileKind
from app.models.calendar_event import CalendarEvent
from app.models.contact import Contact
from app.models.contact_sync import ContactSync
from app.models.integration_account import IntegrationAccount
from app.models.page import Page, PageStatus
from app.models.blog_post import BlogPost, PostStatus
from app.models.analytics import AnalyticsDaily, MetricType
from app.models.media_asset import MediaAsset, AssetType, StorageBackend

# Phase 2 — Billing
from app.models.invoice import Invoice, InvoiceStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.stripe_event import StripeEvent

# Phase 3 — Proposals + Onboarding
from app.models.proposal import (
    Proposal,
    ProposalStatus,
    ProposalVersion,
    ClientOnboarding,
    OnboardingStatus,
    COMPOUND_METHOD_BLOCKS,
)

# Phase 4 — Project Management
from app.models.project import (
    Project,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
    Sprint,
    SprintStatus,
    Task,
    TaskPriority,
    TaskComment,
    task_dependencies,
    WORKFLOW_STEPS,
    CLIENT_VISIBLE_STEP,
)

# Phase 5 — Reporting & Analytics
from app.models.report import (
    ClientReport,
    ReportStatus,
    ReportCadence,
    ReportSchedule,
    PHASE_KPIS,
)

# Phase 6 — Email Marketing + Forms + Automation
from app.models.email_campaign import (
    EmailTemplate,
    TemplateCategory,
    EmailCampaign,
    CampaignStatus,
    EmailSend,
    FormDefinition,
    FormStatus,
    FormSubmission,
    Automation,
    AutomationStatus,
    AutomationTrigger,
    AutomationRun,
)

# Phase 7 — Video, Social Media & AI
from app.models.social_media import (
    SocialAccount,
    SocialPlatform,
    SocialPost,
    PostStatus as SocialPostStatus,
    BrandVoiceProfile,
    AIContentRequest,
    AIContentStatus,
    VideoAsset,
)
from app.models.virtual_agency import (
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
    VirtualAgencyEvent,
    VirtualAgencyEventType,
    virtual_agency_task_dependencies,
)
from app.models.agency import (
    AgencyAccessRequest,
    AgencyAccessRequestStatus,
    AgencyApprovalRequest,
    AgencyApprovalStatus,
    AgencyArtifact,
    AgencyArtifactType,
    ClientEngagement,
    ClientEngagementStatus,
    MarketingRun,
    MarketingRunStage,
    MarketingRunStatus,
)

# Client Portal
from app.models.portal import PortalToken, PortalSession

# coldCallAutomated Ports — Activity Tracking, Lead Scoring, Cost Tracking
from app.models.activity import Activity, ActivityType, ActivityCategory
from app.models.lead_score import LeadScore, ScoringConfig, DEFAULT_WEIGHTS
from app.models.cost_tracker import CostEntry, DailyCostSummary, SpendingLimit

__all__ = [
    # Base
    "Base",
    "OrgMixin",
    "TimestampMixin",
    # Foundation
    "Organization",
    "PlanTier",
    "User",
    "UserRole",
    "AuditLog",
    # Phase 1
    "Lead",
    "QualificationStatus",
    "RevenueRange",
    "Booking",
    "BookingProvider",
    "BookingStatus",
    "BookingProfile",
    "BookingProfileKind",
    "CalendarEvent",
    "Contact",
    "ContactSync",
    "IntegrationAccount",
    "Page",
    "PageStatus",
    "BlogPost",
    "PostStatus",
    "AnalyticsDaily",
    "MetricType",
    # Media (Cloudflare)
    "MediaAsset",
    "AssetType",
    "StorageBackend",
    # Phase 2 — Billing
    "Invoice",
    "InvoiceStatus",
    "Subscription",
    "SubscriptionStatus",
    "StripeEvent",
    # Phase 3 — Proposals + Onboarding
    "Proposal",
    "ProposalStatus",
    "ProposalVersion",
    "ClientOnboarding",
    "OnboardingStatus",
    "COMPOUND_METHOD_BLOCKS",
    # Phase 4 — Project Management
    "Project",
    "ProjectStatus",
    "ProjectType",
    "ProjectVisibility",
    "Sprint",
    "SprintStatus",
    "Task",
    "TaskPriority",
    "TaskComment",
    "task_dependencies",
    "WORKFLOW_STEPS",
    "CLIENT_VISIBLE_STEP",
    # Phase 5 — Reporting
    "ClientReport",
    "ReportStatus",
    "ReportCadence",
    "ReportSchedule",
    "PHASE_KPIS",
    # Phase 6 — Email + Forms + Automation
    "EmailTemplate",
    "TemplateCategory",
    "EmailCampaign",
    "CampaignStatus",
    "EmailSend",
    "FormDefinition",
    "FormStatus",
    "FormSubmission",
    "Automation",
    "AutomationStatus",
    "AutomationTrigger",
    "AutomationRun",
    # Phase 7 — Video + Social + AI
    "SocialAccount",
    "SocialPlatform",
    "SocialPost",
    "SocialPostStatus",
    "BrandVoiceProfile",
    "AIContentRequest",
    "AIContentStatus",
    "VideoAsset",
    "VirtualAgencyTask",
    "VirtualAgencyTaskStatus",
    "VirtualAgencyEvent",
    "VirtualAgencyEventType",
    "virtual_agency_task_dependencies",
    "AgencyAccessRequest",
    "AgencyAccessRequestStatus",
    "AgencyApprovalRequest",
    "AgencyApprovalStatus",
    "AgencyArtifact",
    "AgencyArtifactType",
    "ClientEngagement",
    "ClientEngagementStatus",
    "MarketingRun",
    "MarketingRunStage",
    "MarketingRunStatus",
    # Client Portal
    "PortalToken",
    "PortalSession",
    # coldCallAutomated Ports
    "Activity",
    "ActivityType",
    "ActivityCategory",
    "LeadScore",
    "ScoringConfig",
    "DEFAULT_WEIGHTS",
    "CostEntry",
    "DailyCostSummary",
    "SpendingLimit",
]
