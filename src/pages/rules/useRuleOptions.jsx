import { useQuery } from "@tanstack/react-query";
import { getAllActions, getAllEvents } from "../../core/apis/rulesAPI";

/*
  MS-5088: the rule actions and events are tiny reference lists, fetched once and
  shared by the rules list filters and the add / edit modal (staleTime: Infinity).
*/
const toList = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

export const useRuleActions = () =>
  useQuery({
    queryKey: ["promotion-rules", "actions"],
    queryFn: () => getAllActions().then(toList),
    staleTime: Infinity,
  });

export const useRuleEvents = () =>
  useQuery({
    queryKey: ["promotion-rules", "events"],
    queryFn: () => getAllEvents().then(toList),
    staleTime: Infinity,
  });
