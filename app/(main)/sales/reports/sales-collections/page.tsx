"use client";

import { useMemo } from "react";

interface DepotData {
  depot: string;
  sales: {
    target23: number;
    achieved23: number;
    achv: number;
    achieved22: number;
    growth: number;
  };
  collection: {
    target23: number;
    achieved23: number;
    achv: number;
    achieved22: number;
    growth: number;
  };
}

const tableData: DepotData[] = [
  {
    depot: "Bogura",
    sales: {
      target23: 38295283,
      achieved23: 13687728,
      achv: 36,
      achieved22: 13338527,
      growth: 3,
    },
    collection: {
      target23: 36489722,
      achieved23: 10651838,
      achv: 29,
      achieved22: 12388149,
      growth: -14,
    },
  },
  {
    depot: "Rajshahi",
    sales: {
      target23: 40643293,
      achieved23: 14533507,
      achv: 36,
      achieved22: 14146888,
      growth: 3,
    },
    collection: {
      target23: 17347130,
      achieved23: 11407504,
      achv: 66,
      achieved22: 10660444,
      growth: 7,
    },
  },
  {
    depot: "Cumilla",
    sales: {
      target23: 15545336,
      achieved23: 3955172,
      achv: 25,
      achieved22: 2484379,
      growth: 59,
    },
    collection: {
      target23: 6801749,
      achieved23: 3053099,
      achv: 45,
      achieved22: 2293343,
      growth: 33,
    },
  },
  {
    depot: "Sreemangal",
    sales: {
      target23: 13937567,
      achieved23: 3046909,
      achv: 22,
      achieved22: 1952832,
      growth: 56,
    },
    collection: {
      target23: 4500000,
      achieved23: 2524923,
      achv: 56,
      achieved22: 2236367,
      growth: 13,
    },
  },
  {
    depot: "Chattogram",
    sales: {
      target23: 23077897,
      achieved23: 5417017,
      achv: 23,
      achieved22: 5242984,
      growth: 3,
    },
    collection: {
      target23: 15573869,
      achieved23: 5155233,
      achv: 33,
      achieved22: 4988561,
      growth: 3,
    },
  },
  {
    depot: "Mymensingh",
    sales: {
      target23: 30720844,
      achieved23: 17070488,
      achv: 56,
      achieved22: 13448762,
      growth: 27,
    },
    collection: {
      target23: 15321042,
      achieved23: 17202979,
      achv: 112,
      achieved22: 12148188,
      growth: 42,
    },
  },
  {
    depot: "Rangpur",
    sales: {
      target23: 32523165,
      achieved23: 12677044,
      achv: 39,
      achieved22: 9035118,
      growth: 40,
    },
    collection: {
      target23: 23799886,
      achieved23: 10603736,
      achv: 45,
      achieved22: 8196592,
      growth: 29,
    },
  },
  {
    depot: "Dinajpur",
    sales: {
      target23: 42298639,
      achieved23: 18923794,
      achv: 45,
      achieved22: 17462258,
      growth: 8,
    },
    collection: {
      target23: 15761270,
      achieved23: 12386402,
      achv: 79,
      achieved22: 12767148,
      growth: -3,
    },
  },
  {
    depot: "Jashore",
    sales: {
      target23: 25857062,
      achieved23: 9123031,
      achv: 35,
      achieved22: 8302192,
      growth: 10,
    },
    collection: {
      target23: 29274509,
      achieved23: 9743790,
      achv: 33,
      achieved22: 8435489,
      growth: 16,
    },
  },
  {
    depot: "Barishal",
    sales: {
      target23: 17088025,
      achieved23: 4106011,
      achv: 24,
      achieved22: 3978292,
      growth: 3,
    },
    collection: {
      target23: 11122650,
      achieved23: 3669017,
      achv: 33,
      achieved22: 3509389,
      growth: 5,
    },
  },
];

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function getAchievedCellStyle(value: number): string {
  if (value > 0) {
    return "bg-green-100 text-green-900 font-semibold";
  }
  return "";
}

function getGrowthTextColor(value: number): string {
  if (value < 0) {
    return "text-red-600 font-semibold";
  }
  if (value > 50) {
    return "text-blue-600 font-semibold";
  }
  return "text-blue-600 font-semibold";
}

function getAchvTextColor(value: number): string {
  if (value > 50) {
    return "text-blue-600 font-semibold";
  }
  return "text-blue-600 font-semibold";
}

export default function SalesCollectionTable() {
  const totals = useMemo(() => {
    return {
      sales: {
        target23: tableData.reduce((sum, d) => sum + d.sales.target23, 0),
        achieved23: tableData.reduce((sum, d) => sum + d.sales.achieved23, 0),
        achieved22: tableData.reduce((sum, d) => sum + d.sales.achieved22, 0),
      },
      collection: {
        target23: tableData.reduce((sum, d) => sum + d.collection.target23, 0),
        achieved23: tableData.reduce(
          (sum, d) => sum + d.collection.achieved23,
          0
        ),
        achieved22: tableData.reduce(
          (sum, d) => sum + d.collection.achieved22,
          0
        ),
      },
    };
  }, []);

  const salesTotalAchv = Math.round(
    (totals.sales.achieved23 / totals.sales.target23) * 100
  );
  const salesTotalGrowth = Math.round(
    ((totals.sales.achieved23 - totals.sales.achieved22) /
      totals.sales.achieved22) *
      100
  );
  const collectionTotalAchv = Math.round(
    (totals.collection.achieved23 / totals.collection.target23) * 100
  );
  const collectionTotalGrowth = Math.round(
    ((totals.collection.achieved23 - totals.collection.achieved22) /
      totals.collection.achieved22) *
      100
  );

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg border border-gray-300">
      <table className="w-full border-collapse text-sm md:text-base">
        <thead>
          <tr className="border-b-2 border-gray-400">
            <th
              rowSpan={3}
              className="border-r-2 border-gray-400 p-2 md:p-3 font-bold text-center align-middle bg-gray-50 min-w-24"
            >
              Depots
            </th>
            <th
              colSpan={5}
              className="border-r-2 border-gray-400 p-2 md:p-3 font-bold text-center bg-gray-50"
            >
              Sales
            </th>
            <th
              colSpan={5}
              className="p-2 md:p-3 font-bold text-center bg-gray-50"
            >
              Collection
            </th>
          </tr>
          <tr className="border-b-2 border-gray-400">
            <th
              colSpan={5}
              className="border-r-2 border-gray-400 p-2 md:p-3 font-bold text-center bg-gray-50"
            >
              April,23/22
            </th>
            <th
              colSpan={5}
              className="p-2 md:p-3 font-bold text-center bg-gray-50"
            >
              April,23/22
            </th>
          </tr>
          <tr className="border-b-2 border-gray-400">
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Target&apos;23 (Tk.)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Achieved&apos;23 (Tk.)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-20">
              Achv(%)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Achieved&apos;22 (Tk.)
            </th>
            <th className="border-r-2 border-gray-400 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-20">
              Growth %
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Target&apos;23 (Tk.)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Achieved&apos;23 (Tk.)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-20">
              Achv(%)
            </th>
            <th className="border-r border-gray-300 p-2 md:p-3 font-bold text-center bg-gray-50 min-w-28">
              Achieved&apos;22 (Tk.)
            </th>
            <th className="p-2 md:p-3 font-bold text-center bg-gray-50 min-w-20">
              Growth %
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-300 hover:bg-gray-50">
              <td className="border-r-2 border-gray-400 p-2 md:p-3 font-bold text-left bg-gray-50">
                {row.depot}
              </td>
              {/* Sales Section */}
              <td className="border-r border-gray-300 p-2 md:p-3 text-right font-semibold">
                {formatNumber(row.sales.target23)}
              </td>
              <td
                className={`border-r border-gray-300 p-2 md:p-3 text-right font-semibold ${getAchievedCellStyle(
                  row.sales.achieved23
                )}`}
              >
                {formatNumber(row.sales.achieved23)}
              </td>
              <td
                className={`border-r border-gray-300 p-2 md:p-3 text-right ${getAchvTextColor(
                  row.sales.achv
                )}`}
              >
                {row.sales.achv}%
              </td>
              <td className="border-r border-gray-300 p-2 md:p-3 text-right font-semibold">
                {formatNumber(row.sales.achieved22)}
              </td>
              <td
                className={`border-r-2 border-gray-400 p-2 md:p-3 text-right ${getGrowthTextColor(
                  row.sales.growth
                )}`}
              >
                {row.sales.growth}%
              </td>
              {/* Collection Section */}
              <td className="border-r border-gray-300 p-2 md:p-3 text-right font-semibold">
                {formatNumber(row.collection.target23)}
              </td>
              <td
                className={`border-r border-gray-300 p-2 md:p-3 text-right font-semibold ${getAchievedCellStyle(
                  row.collection.achieved23
                )}`}
              >
                {formatNumber(row.collection.achieved23)}
              </td>
              <td
                className={`border-r border-gray-300 p-2 md:p-3 text-right ${getAchvTextColor(
                  row.collection.achv
                )}`}
              >
                {row.collection.achv}%
              </td>
              <td className="border-r border-gray-300 p-2 md:p-3 text-right font-semibold">
                {formatNumber(row.collection.achieved22)}
              </td>
              <td
                className={`p-2 md:p-3 text-right ${getGrowthTextColor(
                  row.collection.growth
                )}`}
              >
                {row.collection.growth}%
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
            <td className="border-r-2 border-gray-400 p-2 md:p-3 text-left">
              Total
            </td>
            {/* Sales Total */}
            <td className="border-r border-gray-300 p-2 md:p-3 text-right">
              {formatNumber(totals.sales.target23)}
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right bg-green-100 text-green-900">
              {formatNumber(totals.sales.achieved23)}
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right text-blue-600">
              {salesTotalAchv}%
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right">
              {formatNumber(totals.sales.achieved22)}
            </td>
            <td className="border-r-2 border-gray-400 p-2 md:p-3 text-right text-blue-600">
              {salesTotalGrowth}%
            </td>
            {/* Collection Total */}
            <td className="border-r border-gray-300 p-2 md:p-3 text-right">
              {formatNumber(totals.collection.target23)}
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right bg-green-100 text-green-900">
              {formatNumber(totals.collection.achieved23)}
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right text-blue-600">
              {collectionTotalAchv}%
            </td>
            <td className="border-r border-gray-300 p-2 md:p-3 text-right">
              {formatNumber(totals.collection.achieved22)}
            </td>
            <td className="p-2 md:p-3 text-right text-blue-600">
              {collectionTotalGrowth}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
