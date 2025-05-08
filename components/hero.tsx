'use client';

import NextLogo from "./next-logo";
import SupabaseLogo from "./supabase-logo";
import Video from 'next-video';
import botDemo from '/videos/bot-demo.mp4';
import JoinWaitlist from "@/components/waitlist-form";
import { useLanguage } from "@/lib/language-context";

export default function Header() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-16 items-center">
      <div className="flex flex-col md:flex-row gap-8 justify-center w-full items-center">
        <div className="order-2 w-full sm:w-3/4 md:w-1/2 lg:w-1/3 h-auto rounded-lg shadow-lg">
          <Video
            src={botDemo}
            autoPlay
            muted
          />
        </div>

        <div className="flex flex-col justify-evenly">
          <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center">
            {t('title')}{" "}
            <span className="bg-primary px-1 rounded-md">{t('bookings')}</span> {t('and')}{" "}
            <span className="bg-secondary px-1 rounded-md">{t('calendars')}</span> {t('with_ai')}
          </p>

          <div className="md:mt-20">
            <JoinWaitlist />
          </div>
        </div>
      </div>

      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
