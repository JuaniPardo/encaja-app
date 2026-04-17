"use client";

import { ActionIcon, Modal, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { useI18n } from "@/features/i18n/provider";

function FeedbackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 14a2 2 0 0 1-2 2H7l-4 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

export function GlobalFeedbackButton() {
  const { t } = useI18n();
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip
        label={t("settings.feedback.globalButton")}
        withArrow
        position="bottom"
      >
        <ActionIcon
          variant="light"
          color="gray"
          size="sm"
          onClick={open}
          aria-label={t("settings.feedback.globalButtonAria")}
        >
          <FeedbackIcon />
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={close}
        title={t("settings.feedback.modalTitle")}
        centered
      >
        <FeedbackForm hideHeading onSubmitted={close} />
      </Modal>
    </>
  );
}
