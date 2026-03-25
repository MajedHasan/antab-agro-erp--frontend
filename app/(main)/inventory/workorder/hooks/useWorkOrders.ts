import { useEffect, useState } from "react";
import api from "@/lib/api";

export const useWorkOrders = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWorkOrders = async () => {
    setLoading(true);
    const res = await api.get("/work-orders");
    setWorkOrders(res.data.data);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/work-orders/${id}`, { status });
    fetchWorkOrders();
  };

  const approve = async (id: string) => {
    await api.post(`/work-orders/${id}/approve`);
    fetchWorkOrders();
  };

  const cancel = async (id: string, reason: string) => {
    await api.post(`/work-orders/${id}/cancel`, { reason });
    fetchWorkOrders();
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  return {
    workOrders,
    loading,
    fetchWorkOrders,
    updateStatus,
    approve,
    cancel,
  };
};
