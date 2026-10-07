-- نقش‌ها و دیتابیس‌های محلی برای توسعه، تست و CI (رمزها فقط برای همین کامپیوترند).
-- kelid_owner صاحب جدول‌هاست و migrationها را اجرا می‌کند؛ kelid_app که سرور با آن کار می‌کند
-- فقط خواندن و نوشتن ردیف دارد، پس حتی با یک باگ هم نمی‌تواند RLS را خاموش کند.
create role kelid_owner login password 'kelid_owner';
create role kelid_app login password 'kelid_app';
create database kelid owner kelid_owner;
create database kelid_test owner kelid_owner;

\connect kelid
grant usage on schema public to kelid_app;
alter default privileges for role kelid_owner grant select, insert, update, delete on tables to kelid_app;
alter default privileges for role kelid_owner grant usage, select on sequences to kelid_app;

\connect kelid_test
grant usage on schema public to kelid_app;
alter default privileges for role kelid_owner grant select, insert, update, delete on tables to kelid_app;
alter default privileges for role kelid_owner grant usage, select on sequences to kelid_app;
